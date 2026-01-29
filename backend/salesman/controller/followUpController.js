const FollowUp = require("../../database/models/FollowUp");
const VisitTarget = require("../../database/models/VisitTarget");
const hubspotService = require("../../services/hubspotService");

// @desc    Get follow-ups assigned to logged-in salesman
// @route   GET /api/salesman/follow-ups
// @access  Private/Salesman
const getMyFollowUps = async (req, res) => {
  try {
    const { status, type, priority, search } = req.query;
    const filter = { salesman: req.user._id };

    if (status && status !== "All") filter.status = status;
    if (type && type !== "All") filter.type = type;
    if (priority && priority !== "All") filter.priority = priority;
    if (search) {
      filter.$or = [
        { followUpNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerEmail: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Exclude visit-linked auto-tasks – visits show only in Visits list
    // Include Sample Feedback / relatedSample – sample tasks show in Tasks (admin + salesman)
    // Exclude old Customer Allotment tasks – allotment is now simple (allottedSalesman), not a follow-up task
    filter.$nor = [
      { type: "Visit", visitTarget: { $exists: true, $ne: null } },
      { notes: { $regex: /Customer Allotment/i } },
      { description: { $regex: /Customer allocated:/i } },
    ];

    const followUps = await FollowUp.find(filter)
      .populate("customer", "name email phone company")
      .populate("relatedQuotation", "quotationNumber total")
      .populate("relatedSample", "sampleNumber productName")
      .populate("visitTarget", "name address status visitDate")
      .populate("createdBy", "name email role")
      .sort({ dueDate: 1, priority: -1 })
      .lean();

    const seenIds = new Set();
    const unique = followUps.filter((f) => {
      const id = (f._id && f._id.toString()) || (f.id && f.id.toString());
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    res.status(200).json({
      success: true,
      count: unique.length,
      data: unique,
    });
  } catch (error) {
    console.error("getMyFollowUps error:", error);
    res.status(500).json({
      success: false,
      message:
        error && error.message
          ? String(error.message)
          : "Error fetching follow-ups",
    });
  }
};

// @desc    Get single follow-up (salesman-owned)
// @route   GET /api/salesman/follow-ups/:id
// @access  Private/Salesman
const getMyFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    })
      .populate("customer", "name email phone address company")
      .populate("relatedQuotation", "quotationNumber total status")
      .populate("relatedSample", "sampleNumber productName status")
      .populate("visitTarget", "name address city status visitDate")
      .populate("createdBy", "name email role");

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: "Follow-up not found",
      });
    }

    res.status(200).json({
      success: true,
      data: followUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching follow-up",
    });
  }
};

// @desc    Create follow-up (salesman creates their own task)
// @route   POST /api/salesman/follow-ups
// @access  Private/Salesman
const createMyFollowUp = async (req, res) => {
  try {
    const {
      customer,
      customerName,
      customerEmail,
      customerPhone,
      type,
      priority,
      scheduledDate,
      dueDate,
      description,
      notes,
      relatedQuotation,
      relatedSample,
      relatedOrder,
      visitTarget,
    } = req.body;

    if (!customerName || !type || !dueDate) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields (customerName, type, dueDate)",
      });
    }

    // Time validation: same salesman cannot have two tasks or a task and a visit at the same time (same minute)
    const due = new Date(dueDate);
    if (!isNaN(due.getTime())) {
      const startOfMinute = new Date(
        due.getFullYear(),
        due.getMonth(),
        due.getDate(),
        due.getHours(),
        due.getMinutes(),
        0,
        0,
      );
      const endOfMinute = new Date(startOfMinute.getTime() + 60000);
      const taskConflict = await FollowUp.findOne({
        salesman: req.user._id,
        status: { $ne: "Completed" },
        dueDate: { $gte: startOfMinute, $lt: endOfMinute },
      });
      if (taskConflict) {
        return res.status(400).json({
          success: false,
          message:
            "A task already exists at this time. Please choose a different time.",
        });
      }
      const visitConflict = await VisitTarget.findOne({
        salesman: req.user._id,
        status: { $in: ["Pending", "In Progress"] },
        visitDate: { $gte: startOfMinute, $lt: endOfMinute },
      });
      if (visitConflict) {
        return res.status(400).json({
          success: false,
          message:
            "A visit is already scheduled at this time. Please choose a different time.",
        });
      }
    }

    const followUp = await FollowUp.create({
      salesman: req.user._id, // Always use logged-in salesman
      customer,
      customerName,
      customerEmail,
      customerPhone,
      type,
      priority: priority || "Medium",
      scheduledDate: scheduledDate || dueDate,
      dueDate,
      description,
      notes,
      relatedQuotation,
      relatedSample,
      relatedOrder,
      visitTarget,
      createdBy: req.user._id,
      approvalStatus: "Pending", // Salesman tasks need admin approval
    });

    // ❌ NO HUBSPOT SYNC - Will be posted to HubSpot only after admin approval

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate("customer", "name email phone company")
      .populate("relatedQuotation", "quotationNumber total")
      .populate("relatedSample", "sampleNumber productName");

    res.status(201).json({
      success: true,
      message:
        "Follow-up created successfully. It will also be posted to HubSpot.",
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error creating follow-up",
    });
  }
};

// @desc    Update follow-up (salesman-owned) - mark complete / add notes
// @route   PUT /api/salesman/follow-ups/:id
// @access  Private/Salesman
const updateMyFollowUp = async (req, res) => {
  try {
    const { status, notes, completedDate } = req.body;

    const followUp = await FollowUp.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: "Follow-up not found",
      });
    }

    if (notes !== undefined) followUp.notes = notes;

    // Salesman can only mark as Completed if task is approved
    if (status && status === "Completed") {
      if (followUp.approvalStatus !== "Approved") {
        return res.status(400).json({
          success: false,
          message: "Cannot complete task. Task must be approved first.",
        });
      }
      followUp.status = "Completed";
      if (!followUp.completedDate) {
        followUp.completedDate = completedDate || new Date();
      }
    }

    await followUp.save();

    res.status(200).json({
      success: true,
      message: "Follow-up updated successfully",
      data: followUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error updating follow-up",
    });
  }
};

module.exports = {
  getMyFollowUps,
  getMyFollowUp,
  createMyFollowUp,
  updateMyFollowUp,
};
