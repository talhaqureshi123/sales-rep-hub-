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
      approvalStatus: "Approved", // Salesman-created follow-ups: no admin approval needed
    });

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate("customer", "name email phone company")
      .populate("relatedQuotation", "quotationNumber total")
      .populate("relatedSample", "sampleNumber productName");

    res.status(201).json({
      success: true,
      message: "Follow-up created successfully.",
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

// @desc    Import tasks from Excel/CSV (bulk – all assigned to logged-in salesman)
// @route   POST /api/salesman/follow-ups/import
// @access  Private/Salesman
const importMyFollowUps = async (req, res) => {
  try {
    const { tasks: rawTasks } = req.body;
    if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a non-empty array of tasks",
      });
    }

    const validTypes = ["Call", "Visit", "Email", "Meeting", "WhatsApp", "Other", "Quote Follow-up", "Sample Feedback", "Order Check"];
    const validPriorities = ["Low", "Medium", "High", "Urgent"];
    const created = [];
    const skipped = [];
    const salesmanId = req.user._id;

    for (let i = 0; i < rawTasks.length; i++) {
      const row = rawTasks[i];
      const customerName = row.customerName != null ? String(row.customerName).trim() : (row.customer_name != null ? String(row.customer_name).trim() : null);
      if (!customerName) {
        skipped.push({ row: i + 1, reason: "Missing customer name" });
        continue;
      }

      const typeRaw = (row.type || row.taskType || "").trim();
      const type = validTypes.includes(typeRaw) ? typeRaw : "Call";
      const dueDateRaw = row.dueDate || row.due_date || row.date;
      const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
      if (!dueDate || isNaN(dueDate.getTime())) {
        skipped.push({ row: i + 1, reason: "Missing or invalid due date" });
        continue;
      }

      const priority = validPriorities.includes((row.priority || "").trim()) ? (row.priority || "").trim() : "Medium";
      const description = row.description ? String(row.description).trim() : `Follow-up: ${customerName}`;
      const notes = row.notes ? String(row.notes).trim() : undefined;
      const customerEmail = row.customerEmail || row.customer_email ? String(row.customerEmail || row.customer_email).trim() : undefined;
      const customerPhone = row.customerPhone || row.customer_phone ? String(row.customerPhone || row.customer_phone).trim() : undefined;

      try {
        const startOfMinute = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), dueDate.getHours(), dueDate.getMinutes(), 0, 0);
        const endOfMinute = new Date(startOfMinute.getTime() + 60000);
        const taskConflict = await FollowUp.findOne({
          salesman: salesmanId,
          status: { $ne: "Completed" },
          dueDate: { $gte: startOfMinute, $lt: endOfMinute },
        });
        if (taskConflict) {
          skipped.push({ row: i + 1, reason: "A task already exists at this time" });
          continue;
        }
        const visitConflict = await VisitTarget.findOne({
          salesman: salesmanId,
          status: { $in: ["Pending", "In Progress"] },
          visitDate: { $gte: startOfMinute, $lt: endOfMinute },
        });
        if (visitConflict) {
          skipped.push({ row: i + 1, reason: "A visit is already scheduled at this time" });
          continue;
        }

        const followUp = await FollowUp.create({
          salesman: salesmanId,
          customerName,
          customerEmail,
          customerPhone,
          type,
          priority,
          scheduledDate: dueDate,
          dueDate,
          description,
          notes,
          createdBy: req.user._id,
          approvalStatus: "Approved",
          source: "app",
        });
        created.push({ _id: followUp._id, followUpNumber: followUp.followUpNumber, customerName: followUp.customerName });
      } catch (err) {
        skipped.push({ row: i + 1, reason: err.message || "Validation error" });
      }
    }

    res.status(200).json({
      success: true,
      message: `Imported ${created.length} task(s)`,
      data: { created, skipped, createdCount: created.length, skippedCount: skipped.length },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error importing tasks",
    });
  }
};

module.exports = {
  getMyFollowUps,
  getMyFollowUp,
  createMyFollowUp,
  updateMyFollowUp,
  importMyFollowUps,
};
