const FollowUp = require("../../database/models/FollowUp");
const VisitTarget = require("../../database/models/VisitTarget");
const hubspotService = require("../../services/hubspotService");
const { notifyUser } = require("../../sockets/notificationSocket");

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

    notifyUser(req.user._id);
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

    notifyUser(followUp.salesman);
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

// Parse date from CSV/Excel (multiple formats)
function parseTaskDueDate(val) {
  if (val == null || String(val).trim() === "") return null;
  const s = String(val).trim();
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  const parts = s.split(/[/\-.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10) - 1;
    const p2 = parseInt(parts[2], 10);
    if (p0 > 31) return new Date(p0, p1, p2);
    if (p2 > 31) return new Date(p2, p1, p0);
    const asDDMM = new Date(p2, p1, p0);
    if (!isNaN(asDDMM.getTime())) return asDDMM;
    return new Date(p0, p1, p2);
  }
  const num = parseInt(s, 10);
  if (!isNaN(num) && num > 0) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

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
    const myEmail = (req.user.email && String(req.user.email).trim().toLowerCase()) || "";

    for (let i = 0; i < rawTasks.length; i++) {
      const row = rawTasks[i];
      const customerName = row.customerName != null ? String(row.customerName).trim() : (row.customer_name != null ? String(row.customer_name).trim() : null);
      if (!customerName) {
        skipped.push({ row: i + 1, reason: "Missing customer name" });
        continue;
      }

      // Kisi aur salesman ke task is salesman ke account mein import na hon
      const rowEmail = (row.salesmanEmail || row.salesman_email || "").trim().toLowerCase();
      const rowId = row.salesmanId || row.salesman_id;
      if (rowEmail && myEmail && rowEmail !== myEmail) {
        skipped.push({ row: i + 1, reason: "This task is for another salesman; you can only import your own tasks" });
        continue;
      }
      if (rowId && String(rowId) !== String(salesmanId)) {
        skipped.push({ row: i + 1, reason: "This task is for another salesman; you can only import your own tasks" });
        continue;
      }

      const typeRaw = (row.type || row.taskType || "").trim();
      const type = validTypes.includes(typeRaw) ? typeRaw : "Call";
      const dueDateRaw = row.dueDate || row.due_date || row.date;
      const dueDate = parseTaskDueDate(dueDateRaw);
      if (!dueDate || isNaN(dueDate.getTime())) {
        skipped.push({ row: i + 1, reason: "Missing or invalid due date (use YYYY-MM-DD or DD/MM/YYYY)" });
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
          const isExactDuplicate = taskConflict.customerName === customerName && taskConflict.type === type && taskConflict.description === description;
          skipped.push({ row: i + 1, reason: isExactDuplicate ? "Exact same task already exists" : "A task already exists at this time" });
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

    if (created.length > 0) notifyUser(req.user._id);
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
