const VisitTarget = require("../../database/models/VisitTarget");
const FollowUp = require("../../database/models/FollowUp");
const hubspotService = require("../../services/hubspotService");
const Customer = require("../../database/models/Customer");
const { saveShiftPhotoToFolder } = require("../../utils/shiftPhotoStorage");

// ================= HELPER =================
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ================= CREATE REQUEST (SALESMAN) =================
// Salesman can request a new visit target; admin must approve before it becomes active.
const createVisitRequest = async (req, res) => {
  try {
    const {
      name,
      targetName,
      description,
      latitude,
      longitude,
      address,
      city,
      state,
      pincode,
      priority,
      visitDate,
      notes,
      customerName,
      customerId,
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide visit target name" });
    }

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "Please provide latitude and longitude",
      });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude values",
      });
    }

    // visitDate is required by model; if not provided, default to today.
    const finalVisitDate = visitDate ? new Date(visitDate) : new Date();

    // Same time: same salesman cannot have two visits or a visit and a task at the same time (same minute)
    if (!Number.isNaN(finalVisitDate.getTime())) {
      const startOfMinute = new Date(
        finalVisitDate.getFullYear(),
        finalVisitDate.getMonth(),
        finalVisitDate.getDate(),
        finalVisitDate.getHours(),
        finalVisitDate.getMinutes(),
        0,
        0
      );
      const endOfMinute = new Date(startOfMinute.getTime() + 60000);
      const visitConflict = await VisitTarget.findOne({
        salesman: req.user._id,
        status: { $in: ["Pending", "In Progress"] },
        visitDate: { $gte: startOfMinute, $lt: endOfMinute },
      });
      if (visitConflict) {
        return res.status(400).json({
          success: false,
          message: "A visit is already scheduled at this time. Please choose a different time.",
        });
      }
      const taskConflict = await FollowUp.findOne({
        salesman: req.user._id,
        status: { $ne: "Completed" },
        dueDate: { $gte: startOfMinute, $lt: endOfMinute },
      });
      if (taskConflict) {
        return res.status(400).json({
          success: false,
          message: "A task is already scheduled at this time. Please choose a different time.",
        });
      }
    }

    const vt = await VisitTarget.create({
      name,
      targetName: targetName || name, // Store target name if provided
      description,
      salesman: req.user._id,
      createdBy: req.user._id,
      latitude: latNum,
      longitude: lngNum,
      address,
      city,
      state,
      pincode,
      priority: priority || "Medium",
      visitDate: finalVisitDate,
      notes,
      status: "Pending",
      approvalStatus: "Pending",
      customerName: customerName || name, // Store customer name for admin display
      customerId: customerId || undefined, // Store customer ID if provided
    });

    const populated = await VisitTarget.findById(vt._id)
      .populate("salesman", "name email")
      .populate("createdBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Visit request submitted. Waiting for admin approval.",
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ================= GET MY REQUESTS (SALESMAN) =================
// Lists non-approved requests for the current salesman (Pending/Rejected)
const getMyVisitRequests = async (req, res) => {
  try {
    const filter = {
      salesman: req.user._id,
      approvalStatus: { $in: ["Pending", "Rejected"] },
    };

    const requests = await VisitTarget.find(filter)
      .populate("salesman", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("getMyVisitRequests error:", error);
    return res.status(500).json({
      success: false,
      message: (error && error.message) ? String(error.message) : "Error fetching visit requests",
    });
  }
};

// ================= GET ALL =================
const getVisitTargets = async (req, res) => {
  try {
    const { status, priority, approvalStatus } = req.query;
    const filter = { salesman: req.user._id };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    // Default: only show approved targets to salesman (requested targets become visible after admin approval)
    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    } else {
      // Backward compatible: old docs may not have approvalStatus field (treat as Approved)
      filter.$or = [
        { approvalStatus: "Approved" },
        { approvalStatus: { $exists: false } },
      ];
    }

    const visitTargets = await VisitTarget.find(filter)
      .populate("salesman", "name email")
      .populate("createdBy", "name email")
      .populate("customerId", "latitude longitude name address")
      .sort({ createdAt: -1 })
      .lean();

    // 🔁 HUBSPOT SYNC (NON-BLOCKING)
    (async () => {
      try {
        const pendingTargets = visitTargets.filter((v) => {
          const isApproved = !v.approvalStatus || v.approvalStatus === "Approved";
          return v.status === "Pending" && isApproved;
        });
        for (const target of pendingTargets) {
          const customer = await Customer.findOne({
            assignedSalesman: req.user._id,
            $or: [
              { name: { $regex: target.name, $options: "i" } },
              { address: { $regex: target.address || "", $options: "i" } },
            ],
          });

          if (!customer?.email) continue;

          let contactId = await hubspotService.findContactByEmail(
            customer.email
          );
          if (!contactId) {
            const contact = await hubspotService.createOrUpdateContact(
              customer
            );
            contactId = contact?.id;
          }

          if (contactId) {
            await hubspotService.syncVisitTargetAsTask(target, contactId);
          }
        }
      } catch (err) {
        console.error("HubSpot sync error:", err.message);
      }
    })();

    res.status(200).json({
      success: true,
      count: visitTargets.length,
      data: visitTargets,
    });
  } catch (error) {
    console.error("getVisitTargets error:", error);
    res.status(500).json({
      success: false,
      message: (error && error.message) ? String(error.message) : "Error fetching visit targets",
    });
  }
};

// ================= GET SINGLE =================
const getVisitTarget = async (req, res) => {
  try {
    const visitTarget = await VisitTarget.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    })
      .populate("salesman", "name email")
      .populate("createdBy", "name email")
      .lean();

    if (!visitTarget) {
      return res
        .status(404)
        .json({ success: false, message: "Visit target not found" });
    }

    res.status(200).json({ success: true, data: visitTarget });
  } catch (error) {
    console.error("getVisitTarget error:", error);
    res.status(500).json({
      success: false,
      message: (error && error.message) ? String(error.message) : "Error fetching visit target",
    });
  }
};

// ================= UPDATE STATUS =================
// Uses findOneAndUpdate (not find + save) to avoid Mongoose VersionError when __v has changed (e.g. concurrent updates).
const updateVisitTargetStatus = async (req, res) => {
  try {
    const {
      status,
      notes,
      comments,
      visitDate,
      startingKilometers,
      endingKilometers,
      estimatedKilometers,
      meterImage,
      visitedAreaImage,
      visitedAreaImages, // Array of multiple images
      trackingId,
      quotationId,
    } = req.body;

    const filter = { _id: req.params.id, salesman: req.user._id };
    const existing = await VisitTarget.findOne(filter);

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Visit target not found" });
    }

    // Enforce: salesman can only act on approved targets
    if (existing.approvalStatus && existing.approvalStatus !== "Approved") {
      return res.status(403).json({
        success: false,
        message: "This visit is not approved yet. Please wait for admin approval.",
      });
    }

    const previousStatus = existing.status;
    const nextStatus = status || existing.status;

    // KM VALIDATION (before building update)
    if (
      startingKilometers !== undefined &&
      endingKilometers !== undefined &&
      endingKilometers !== null &&
      startingKilometers !== null &&
      endingKilometers < startingKilometers
    ) {
      return res.status(400).json({
        success: false,
        message: "Ending kilometers cannot be less than starting kilometers",
      });
    }

    // Enforce mandatory fields for completion (shift photos)
    if (nextStatus === "Completed" && previousStatus !== "Completed") {
      const hasVisitedAreaImage =
        (visitedAreaImage || existing.visitedAreaImage) ||
        (Array.isArray(visitedAreaImages) && visitedAreaImages.length > 0) ||
        (Array.isArray(existing.visitedAreaImages) && existing.visitedAreaImages.length > 0);
      if (!hasVisitedAreaImage) {
        return res.status(400).json({
          success: false,
          message: "Visited area image is required to complete the visit",
        });
      }
    }

    // Build update object (atomic update avoids __v version conflict)
    const update = {};

    if (status) {
      update.status = status;
      if (status === "Completed" && previousStatus !== "Completed") {
        update.completedAt = new Date();
      }
      if (status !== "Completed") {
        update.completedAt = null;
      }
    }
    if (notes !== undefined) update.notes = notes;
    if (comments !== undefined) update.comments = comments;
    if (visitDate !== undefined) update.visitDate = visitDate;

    if (startingKilometers !== undefined) update.startingKilometers = startingKilometers;
    if (endingKilometers !== undefined) update.endingKilometers = endingKilometers;
    if (startingKilometers !== undefined && endingKilometers !== undefined) {
      update.actualKilometers = endingKilometers - startingKilometers;
    }
    if (estimatedKilometers !== undefined) {
      const num = Number(estimatedKilometers);
      update.estimatedKilometers = (typeof num === "number" && !Number.isNaN(num) && num >= 0) ? num : 0;
    }
    if (meterImage !== undefined) update.meterImage = meterImage;

    const isBase64Like = (v) => typeof v === "string" && v && (v.startsWith("data:") || !v.startsWith("/"));
    const visitId = "visit-" + String(existing._id);

    if (visitedAreaImages !== undefined && Array.isArray(visitedAreaImages)) {
      const filtered = visitedAreaImages.filter((img) => img && img.trim() !== "");
      const paths = filtered.map((img, i) => isBase64Like(img) ? saveShiftPhotoToFolder(img, visitId, "visited", i) || img : img);
      update.visitedAreaImages = [...new Set(paths)];
      update.visitedAreaImage = update.visitedAreaImages[0] || null;
    } else if (visitedAreaImage !== undefined) {
      const path = isBase64Like(visitedAreaImage) ? saveShiftPhotoToFolder(visitedAreaImage, visitId, "visited", 0) || visitedAreaImage : visitedAreaImage;
      update.visitedAreaImage = path;
      const prevArr = existing.visitedAreaImages || [];
      if (path && !prevArr.includes(path)) {
        update.visitedAreaImages = [path, ...prevArr.filter((img) => img !== path)];
      }
    }

    if (trackingId !== undefined) update.trackingId = trackingId;

    if (nextStatus === "Completed" && previousStatus !== "Completed") {
      const finalEstimated =
        estimatedKilometers !== undefined
          ? Number(estimatedKilometers)
          : Number(existing.estimatedKilometers ?? 0);
      update.estimatedKilometers =
        finalEstimated !== undefined && !Number.isNaN(finalEstimated) && finalEstimated >= 0
          ? finalEstimated
          : 0;
    }

    if (quotationId !== undefined) {
      update.quotationId = quotationId;
      update.quotationCreated = !!quotationId;
    }

    const visitTarget = await VisitTarget.findOneAndUpdate(
      filter,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!visitTarget) {
      return res.status(404).json({ success: false, message: "Visit target not found" });
    }

    const data = visitTarget.toObject ? visitTarget.toObject() : visitTarget;

    // HUBSPOT COMPLETION NOTE (fire-and-forget)
    if (status === "Completed" && previousStatus !== "Completed") {
      (async () => {
        try {
          const customer = await Customer.findOne({
            assignedSalesman: req.user._id,
            $or: [
              { name: { $regex: visitTarget.name, $options: "i" } },
              { address: { $regex: visitTarget.address || "", $options: "i" } },
            ],
          });
          if (!customer?.email) return;
          const contactId = await hubspotService.findContactByEmail(customer.email);
          if (!contactId) return;
          await hubspotService.createNote(
            contactId,
            `Visit Completed: ${visitTarget.name}\nKM: ${visitTarget.actualKilometers || 0}`,
            "VISIT_COMPLETED"
          );
        } catch (err) {
          console.error("HubSpot completion sync error:", err.message);
        }
      })();
    }

    res.status(200).json({
      success: true,
      message: "Visit target updated successfully",
      data,
    });
  } catch (error) {
    console.error("updateVisitTargetStatus error:", error);
    res.status(500).json({
      success: false,
      message: (error && error.message) ? String(error.message) : "Error updating visit target",
    });
  }
};

// ================= PROXIMITY =================
const checkProximity = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude required",
      });
    }

    const visitTarget = await VisitTarget.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!visitTarget) {
      return res
        .status(404)
        .json({ success: false, message: "Visit target not found" });
    }

    // Enforce: proximity checks only for approved targets
    if (visitTarget.approvalStatus && visitTarget.approvalStatus !== "Approved") {
      return res.status(403).json({
        success: false,
        message: "This visit is not approved yet. Please wait for admin approval.",
      });
    }

    const distance = calculateDistance(
      latitude,
      longitude,
      visitTarget.latitude,
      visitTarget.longitude
    );

    res.status(200).json({
      success: true,
      data: {
        distance: distance.toFixed(2),
        isWithinProximity: distance <= visitTarget.proximityRadius,
        proximityRadius: visitTarget.proximityRadius,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= EXPORT =================
module.exports = {
  getVisitTargets,
  getMyVisitRequests,
  createVisitRequest,
  getVisitTarget,
  updateVisitTargetStatus,
  checkProximity,
};
