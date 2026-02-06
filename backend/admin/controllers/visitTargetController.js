const VisitTarget = require("../../database/models/VisitTarget");
const User = require("../../database/models/User");
const hubspotService = require("../../services/hubspotService");
const Customer = require("../../database/models/Customer");
const FollowUp = require("../../database/models/FollowUp");

// @desc    Get all visit targets
// @route   GET /api/admin/visit-targets
// @access  Private/Admin
const getVisitTargets = async (req, res) => {
  try {
    const { salesman, status, priority, search, approvalStatus, date } = req.query;
    const filter = {};

    if (salesman) {
      filter.salesman = salesman;
    }
    if (status) {
      filter.status = status;
    }
    if (priority) {
      filter.priority = priority;
    }
    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    // date=YYYY-MM-DD: visits on that day (completedAt or visitDate)
    if (date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const dateCondition = {
          $or: [
            { completedAt: { $gte: dayStart, $lt: dayEnd } },
            { visitDate: { $gte: dayStart, $lt: dayEnd } },
          ],
        };
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, dateCondition];
          delete filter.$or;
        } else {
          Object.assign(filter, dateCondition);
        }
      }
    }

    const listView = req.query.listView === "1" || req.query.listView === "true";
    const listLimit = Math.min(parseInt(req.query.limit, 10) || 150, 400);

    const visitTargets = listView
      ? await VisitTarget.find(filter)
          .select("name customerName address city state pincode visitDate status approvalStatus priority salesman createdBy createdAt completedAt description actualKilometers estimatedKilometers startingKilometers endingKilometers meterImage quotationCreated comments notes")
          .populate("salesman", "name email")
          .populate("createdBy", "name email role")
          .sort({ createdAt: -1 })
          .limit(listLimit)
          .lean()
      : await VisitTarget.find(filter)
          .populate("salesman", "name email")
          .populate("createdBy", "name email role")
          .sort({ createdAt: -1 });

    // Sync pending+approved visit targets as tasks to HubSpot (async, non-blocking) – skip in listView to avoid extra work
    if (!listView) {
      (async () => {
        try {
          const pendingTargets = visitTargets.filter((vt) => {
          const isApproved =
            !vt.approvalStatus || vt.approvalStatus === "Approved";
          return vt.status === "Pending" && isApproved;
        });
        for (const target of pendingTargets) {
          // Try to find customer by visit target
          const customer = await Customer.findOne({
            $or: [
              { address: { $regex: target.address || "", $options: "i" } },
              { name: { $regex: target.name, $options: "i" } },
            ],
            assignedSalesman: target.salesman,
          });

          if (customer && customer.email) {
            let contactId = await hubspotService.findContactByEmail(
              customer.email,
            );
            if (!contactId) {
              // Create contact if not exists
              const contact = await hubspotService.createOrUpdateContact({
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                address: customer.address,
                city: customer.city,
                state: customer.state,
                pincode: customer.pincode,
                company: customer.company,
                status: customer.status,
              });
              contactId = contact?.id;
            }

            if (contactId) {
              // Sync visit target as task
              await hubspotService.syncVisitTargetAsTask(target, contactId);
            }
          }
        }
      } catch (error) {
        console.error("HubSpot task sync error (non-blocking):", error.message);
      }
    })();
    }

    res.status(200).json({
      success: true,
      count: visitTargets.length,
      data: visitTargets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching visit targets",
    });
  }
};

// @desc    Get single visit target
// @route   GET /api/admin/visit-targets/:id
// @access  Private/Admin
const getVisitTarget = async (req, res) => {
  try {
    const visitTarget = await VisitTarget.findById(req.params.id)
      .populate("salesman", "name email")
      .populate("createdBy", "name email");

    if (!visitTarget) {
      return res.status(404).json({
        success: false,
        message: "Visit target not found",
      });
    }

    res.status(200).json({
      success: true,
      data: visitTarget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching visit target",
    });
  }
};

// @desc    Create visit target
// @route   POST /api/admin/visit-targets
// @access  Private/Admin
const createVisitTarget = async (req, res) => {
  try {
    const {
      name,
      description,
      salesman,
      latitude,
      longitude,
      address,
      city,
      state,
      pincode,
      priority,
      visitDate,
      notes,
      // proximityRadius, // REMOVED - Not needed
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Please provide visit target name",
      });
    }

    if (!salesman) {
      return res.status(400).json({
        success: false,
        message: "Please assign to a salesman",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Please provide latitude and longitude",
      });
    }

    // Convert latitude and longitude to numbers
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude values",
      });
    }

    // Verify assignee exists: must be a salesman, or admin assigning to themselves
    const salesmanUser = await User.findById(salesman);
    if (!salesmanUser) {
      return res.status(400).json({
        success: false,
        message: "Invalid salesman selected",
      });
    }
    const isAdminSelf =
      req.user.role === "admin" &&
      salesmanUser._id.toString() === req.user._id.toString();
    if (salesmanUser.role !== "salesman" && !isAdminSelf) {
      return res.status(400).json({
        success: false,
        message: "Invalid salesman selected",
      });
    }

    // No same-time conflict check: admin can create multiple visits/tasks at the same time for a salesman.

    const visitTarget = await VisitTarget.create({
      name,
      description,
      salesman,
      latitude: latNum,
      longitude: lngNum,
      address,
      city,
      state,
      pincode,
      priority: priority || "Medium",
      visitDate: visitDate ? new Date(visitDate) : undefined,
      notes,
      // proximityRadius will use default from model (0.1) - Not needed to pass explicitly
      createdBy: req.user._id,
      approvalStatus: "Approved",
      approvedAt: new Date(),
      approvedBy: req.user._id,
    });

    const populatedVisitTarget = await VisitTarget.findById(visitTarget._id)
      .populate("salesman", "name email")
      .populate("createdBy", "name email");

    // Do NOT auto-create FollowUp (task) when admin creates a visit target – visits show only in Visits list,
    // so salesman does not see "extra" tasks that were never created by them.

    // Sync visit target as task to HubSpot (async, non-blocking) (approved only)
    (async () => {
      try {
        if (visitTarget.approvalStatus !== "Approved") return;
        // Try to find customer by visit target
        const customer = await Customer.findOne({
          $or: [
            { address: { $regex: visitTarget.address || "", $options: "i" } },
            { name: { $regex: visitTarget.name, $options: "i" } },
          ],
          assignedSalesman: visitTarget.salesman,
        });

        if (customer && customer.email) {
          let contactId = await hubspotService.findContactByEmail(
            customer.email,
          );
          if (!contactId) {
            // Create contact if not exists
            const contact = await hubspotService.createOrUpdateContact({
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              city: customer.city,
              state: customer.state,
              pincode: customer.pincode,
              company: customer.company,
              status: customer.status,
            });
            contactId = contact?.id;
          }

          if (contactId && visitTarget.status === "Pending") {
            // Sync visit target as task (only for pending targets)
            await hubspotService.syncVisitTargetAsTask(visitTarget, contactId);
          }
        }
      } catch (error) {
        console.error("HubSpot task sync error (non-blocking):", error.message);
      }
    })();

    res.status(201).json({
      success: true,
      message: "Visit target created successfully",
      data: populatedVisitTarget,
    });
  } catch (error) {
    console.error("Error creating visit target:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error creating visit target",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    Update visit target
// @route   PUT /api/admin/visit-targets/:id
// @access  Private/Admin
const updateVisitTarget = async (req, res) => {
  try {
    const {
      name,
      description,
      salesman,
      latitude,
      longitude,
      address,
      city,
      state,
      pincode,
      status,
      approvalStatus,
      rejectionReason,
      priority,
      visitDate,
      notes,
      // proximityRadius, // REMOVED - Not needed
    } = req.body;

    let visitTarget = await VisitTarget.findById(req.params.id);

    if (!visitTarget) {
      return res.status(404).json({
        success: false,
        message: "Visit target not found",
      });
    }

    const previousStatus = visitTarget.status;
    const previousSalesman = visitTarget.salesman?.toString();
    const previousApprovalStatus = visitTarget.approvalStatus;

    // If salesman is being changed, verify new assignee (salesman or admin self)
    if (salesman && salesman !== visitTarget.salesman.toString()) {
      const salesmanUser = await User.findById(salesman);
      if (!salesmanUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid salesman selected",
        });
      }
      const isAdminSelf =
        req.user.role === "admin" &&
        salesmanUser._id.toString() === req.user._id.toString();
      if (salesmanUser.role !== "salesman" && !isAdminSelf) {
        return res.status(400).json({
          success: false,
          message: "Invalid salesman selected",
        });
      }
    }

    // Update fields
    if (name) visitTarget.name = name;
    if (description !== undefined) visitTarget.description = description;
    if (salesman) visitTarget.salesman = salesman;
    if (latitude !== undefined) {
      const latNum = parseFloat(latitude);
      if (!isNaN(latNum)) visitTarget.latitude = latNum;
    }
    if (longitude !== undefined) {
      const lngNum = parseFloat(longitude);
      if (!isNaN(lngNum)) visitTarget.longitude = lngNum;
    }
    if (address !== undefined) visitTarget.address = address;
    if (city !== undefined) visitTarget.city = city;
    if (state !== undefined) visitTarget.state = state;
    if (pincode !== undefined) visitTarget.pincode = pincode;
    if (status) visitTarget.status = status;

    // Approval flow (admin)
    if (approvalStatus && approvalStatus !== previousApprovalStatus) {
      if (approvalStatus === "Approved") {
        visitTarget.approvalStatus = "Approved";
        visitTarget.approvedAt = new Date();
        visitTarget.approvedBy = req.user._id;
        visitTarget.rejectedAt = undefined;
        visitTarget.rejectedBy = undefined;
        visitTarget.rejectionReason = undefined;
      } else if (approvalStatus === "Rejected") {
        visitTarget.approvalStatus = "Rejected";
        visitTarget.rejectedAt = new Date();
        visitTarget.rejectedBy = req.user._id;
        visitTarget.rejectionReason =
          rejectionReason || visitTarget.rejectionReason || "";
        visitTarget.approvedAt = undefined;
        visitTarget.approvedBy = undefined;
      } else if (approvalStatus === "Pending") {
        visitTarget.approvalStatus = "Pending";
        visitTarget.approvedAt = undefined;
        visitTarget.approvedBy = undefined;
        visitTarget.rejectedAt = undefined;
        visitTarget.rejectedBy = undefined;
        visitTarget.rejectionReason = undefined;
      }
    }

    if (priority) visitTarget.priority = priority;
    // No same-time conflict check when updating visitDate
    if (visitDate !== undefined) {
      const vd = visitDate ? new Date(visitDate) : null;
      visitTarget.visitDate = vd && !isNaN(vd.getTime()) ? vd : undefined;
    }
    if (notes !== undefined) visitTarget.notes = notes;
    // if (proximityRadius !== undefined) visitTarget.proximityRadius = proximityRadius; // REMOVED - Not needed

    // If status changed to Completed, set completedAt
    if (status === "Completed" && previousStatus !== "Completed") {
      visitTarget.completedAt = new Date();
    } else if (status && status !== "Completed") {
      visitTarget.completedAt = undefined;
    }

    await visitTarget.save();

    const populatedVisitTarget = await VisitTarget.findById(visitTarget._id)
      .populate("salesman", "name email")
      .populate("createdBy", "name email");

    // Do NOT auto-create FollowUp (task) when visit is approved – visits show only in Visits list,
    // so salesman does not see "extra" tasks that were never created by them.

    // Keep internal task (FollowUp) in sync (non-blocking)
    (async () => {
      try {
        const fu = await FollowUp.findOne({
          visitTarget: visitTarget._id,
          type: "Visit",
        }).sort({ createdAt: -1 });
        if (!fu) return;

        // If salesman changed, update follow-up owner
        if (salesman && salesman !== previousSalesman) {
          fu.salesman = salesman;
        }

        // If date changed, update due/scheduled
        if (visitDate !== undefined) {
          const due = visitDate ? new Date(visitDate) : fu.dueDate;
          fu.scheduledDate = due;
          fu.dueDate = due;
        }

        // If completed/cancelled, mark task completed
        if (status === "Completed" && previousStatus !== "Completed") {
          fu.status = "Completed";
          fu.completedDate = new Date();
        }

        if (status === "Cancelled") {
          fu.status = "Completed";
          fu.completedDate = new Date();
          fu.notes = `${fu.notes || ""}\nCancelled visit target`.trim();
        }

        await fu.save();
      } catch (e) {
        console.error(
          "Error syncing follow-up with visit target (non-blocking):",
          e.message,
        );
      }
    })();

    // Sync to HubSpot if status changed to Completed (async, non-blocking)
    if (status === "Completed") {
      (async () => {
        try {
          // Try to find customer by visit target address or name
          const customer = await Customer.findOne({
            $or: [
              { address: { $regex: visitTarget.address, $options: "i" } },
              { name: { $regex: visitTarget.name, $options: "i" } },
            ],
            assignedSalesman: visitTarget.salesman,
          });

          if (customer && customer.email) {
            // Find contact in HubSpot
            const contactId = await hubspotService.findContactByEmail(
              customer.email,
            );
            if (contactId) {
              // Create note about visit completion
              await hubspotService.createNote(
                contactId,
                `Visit Target Completed: ${visitTarget.name}\nLocation: ${visitTarget.address || visitTarget.city || "N/A"}\nCompleted at: ${new Date().toLocaleString()}\n${visitTarget.notes ? `Notes: ${visitTarget.notes}` : ""}`,
                "VISIT_COMPLETED",
              );

              // Update achievement property
              await hubspotService.updateContactProperty(
                contactId,
                "visit_targets_completed",
                "true",
              );
            }
          }
        } catch (error) {
          console.error("HubSpot sync error (non-blocking):", error.message);
        }
      })();
    }

    res.status(200).json({
      success: true,
      message: "Visit target updated successfully",
      data: populatedVisitTarget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error updating visit target",
    });
  }
};

// @desc    Delete visit target
// @route   DELETE /api/admin/visit-targets/:id
// @access  Private/Admin
const deleteVisitTarget = async (req, res) => {
  try {
    const visitTarget = await VisitTarget.findById(req.params.id);

    if (!visitTarget) {
      return res.status(404).json({
        success: false,
        message: "Visit target not found",
      });
    }

    // Delete linked FollowUp tasks (type Visit) so they disappear from salesman Tasks & Sales Tracking
    await FollowUp.deleteMany({ visitTarget: req.params.id, type: "Visit" });

    await visitTarget.deleteOne();

    res.status(200).json({
      success: true,
      message: "Visit target deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting visit target",
    });
  }
};

// @desc    Get visit targets by salesman
// @route   GET /api/admin/visit-targets/salesman/:salesmanId
// @access  Private/Admin
const getVisitTargetsBySalesman = async (req, res) => {
  try {
    const { salesmanId } = req.params;

    const salesman = await User.findById(salesmanId);
    if (!salesman) {
      return res.status(404).json({
        success: false,
        message: "Salesman not found",
      });
    }
    const isAdminSelf =
      req.user.role === "admin" &&
      salesman._id.toString() === req.user._id.toString();
    if (salesman.role !== "salesman" && !isAdminSelf) {
      return res.status(404).json({
        success: false,
        message: "Salesman not found",
      });
    }

    const visitTargets = await VisitTarget.find({ salesman: salesmanId })
      .populate("salesman", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        salesman: {
          id: salesman._id,
          name: salesman.name,
          email: salesman.email,
        },
        visitTargets,
        count: visitTargets.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching visit targets",
    });
  }
};

// @desc    Get sales targets by salesman with completion stats
// @route   GET /api/admin/visit-targets/salesman/:salesmanId/stats
// @access  Private/Admin
const getSalesmanTargetStats = async (req, res) => {
  try {
    const { salesmanId } = req.params;

    // Get all visit targets for the salesman
    const targets = await VisitTarget.find({ salesman: salesmanId });

    // Calculate stats
    const totalTargets = targets.length;
    const completedTargets = targets.filter(
      (t) => t.status === "Completed",
    ).length;
    const pendingTargets = targets.filter((t) => t.status === "Pending").length;
    const inProgressTargets = targets.filter(
      (t) => t.status === "In Progress",
    ).length;
    const completionRate =
      totalTargets > 0
        ? Math.round((completedTargets / totalTargets) * 100)
        : 0;

    // Get recent completed visits (last 5)
    const recentVisits = await VisitTarget.find({
      salesman: salesmanId,
      status: "Completed",
    })
      .sort({ completedAt: -1 })
      .limit(5)
      .populate("salesman", "name email")
      .lean();

    res.json({
      success: true,
      data: {
        totalTargets,
        completedTargets,
        pendingTargets,
        inProgressTargets,
        completionRate,
        recentVisits,
      },
    });
  } catch (error) {
    console.error("Error getting salesman target stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get salesman target stats",
      error: error.message,
    });
  }
};

module.exports = {
  getVisitTargets,
  getVisitTarget,
  createVisitTarget,
  updateVisitTarget,
  deleteVisitTarget,
  getVisitTargetsBySalesman,
  getSalesmanTargetStats,
};
