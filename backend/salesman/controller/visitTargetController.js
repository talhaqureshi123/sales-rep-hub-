const VisitTarget = require("../../database/models/VisitTarget");
const hubspotService = require("../../services/hubspotService");
const Customer = require("../../database/models/Customer");

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

    const vt = await VisitTarget.create({
      name,
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
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
      .sort({ createdAt: -1 });

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
    res.status(500).json({ success: false, message: error.message });
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
      .populate("createdBy", "name email");

    if (!visitTarget) {
      return res
        .status(404)
        .json({ success: false, message: "Visit target not found" });
    }

    res.status(200).json({ success: true, data: visitTarget });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= UPDATE STATUS =================
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
      trackingId,
      quotationId,
    } = req.body;

    const visitTarget = await VisitTarget.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!visitTarget) {
      return res
        .status(404)
        .json({ success: false, message: "Visit target not found" });
    }

    // Enforce: salesman can only act on approved targets
    if (visitTarget.approvalStatus && visitTarget.approvalStatus !== "Approved") {
      return res.status(403).json({
        success: false,
        message: "This visit is not approved yet. Please wait for admin approval.",
      });
    }

    const previousStatus = visitTarget.status;
    const nextStatus = status || visitTarget.status;

    // STATUS
    if (status) {
      visitTarget.status = status;

      if (status === "Completed" && previousStatus !== "Completed") {
        visitTarget.completedAt = new Date();
      }

      if (status !== "Completed") {
        visitTarget.completedAt = undefined;
      }
    }

    // BASIC FIELDS
    if (notes !== undefined) visitTarget.notes = notes;
    if (comments !== undefined) visitTarget.comments = comments;
    if (visitDate !== undefined) visitTarget.visitDate = visitDate;

    // KM VALIDATION
    // Only validate if both starting and ending kilometers are provided AND not null
    // For individual visit completion, endingKilometers should not be sent (will be set at shift end)
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

    if (startingKilometers !== undefined) {
      visitTarget.startingKilometers = startingKilometers;
    }

    if (endingKilometers !== undefined) {
      visitTarget.endingKilometers = endingKilometers;
    }

    // AUTO CALCULATE ACTUAL KM
    if (startingKilometers !== undefined && endingKilometers !== undefined) {
      visitTarget.actualKilometers = endingKilometers - startingKilometers;
    }

    if (estimatedKilometers !== undefined) {
      visitTarget.estimatedKilometers = estimatedKilometers;
    }

    if (meterImage !== undefined) visitTarget.meterImage = meterImage;
    if (visitedAreaImage !== undefined)
      visitTarget.visitedAreaImage = visitedAreaImage;
    if (trackingId !== undefined) visitTarget.trackingId = trackingId;

    // Enforce mandatory fields for completion (shift photos + KM)
    if (nextStatus === "Completed" && previousStatus !== "Completed") {
      const finalVisitedAreaImage = visitedAreaImage ?? visitTarget.visitedAreaImage;
      if (!finalVisitedAreaImage) {
        return res.status(400).json({
          success: false,
          message: "Visited area image is required to complete the visit",
        });
      }

      const finalEstimated =
        estimatedKilometers !== undefined
          ? Number(estimatedKilometers)
          : Number(visitTarget.estimatedKilometers || 0);
      if (!finalEstimated || Number.isNaN(finalEstimated) || finalEstimated <= 0) {
        return res.status(400).json({
          success: false,
          message: "Estimated kilometers is required to complete the visit",
        });
      }
    }

    if (quotationId !== undefined) {
      visitTarget.quotationId = quotationId;
      visitTarget.quotationCreated = !!quotationId;
    }

    await visitTarget.save();

    // HUBSPOT COMPLETION NOTE
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

          const contactId = await hubspotService.findContactByEmail(
            customer.email
          );
          if (!contactId) return;

          await hubspotService.createNote(
            contactId,
            `Visit Completed: ${visitTarget.name}\nKM: ${
              visitTarget.actualKilometers || 0
            }`,
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
      data: visitTarget,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
