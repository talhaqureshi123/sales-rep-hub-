const SalesTarget = require('../../database/models/SalesTarget');
const User = require('../../database/models/User');
const SalesOrder = require('../../database/models/SalesOrder');
const Quotation = require('../../database/models/Quotation');
const VisitTarget = require('../../database/models/VisitTarget');
const Customer = require('../../database/models/Customer');

// Get salesman ObjectId (works when populated or plain id)
const getSalesmanId = (target) => {
  const s = target.salesman;
  if (!s) return null;
  return s._id ? s._id : s;
};

// Helper function to calculate progress (order count) based on target type
const calculateProgress = async (target) => {
  const startDate = new Date(target.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(target.endDate);
  endDate.setHours(23, 59, 59, 999);
  const salesmanId = getSalesmanId(target);
  if (!salesmanId) return 0;

  if (target.targetType === 'Orders') {
    const orderCount = await SalesOrder.countDocuments({
      salesPerson: salesmanId,
      orderStatus: { $in: ['Confirmed', 'Processing', 'Dispatched', 'Delivered'] },
      orderDate: { $gte: startDate, $lte: endDate }
    });
    return orderCount;
  }
  return 0;
};

// Helper: total order amount for target period (same statuses as progress)
const calculateOrderAmount = async (target) => {
  const startDate = new Date(target.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(target.endDate);
  endDate.setHours(23, 59, 59, 999);
  const salesmanId = getSalesmanId(target);
  if (!salesmanId) return 0;

  if (target.targetType === 'Orders') {
    const result = await SalesOrder.aggregate([
      {
        $match: {
          salesPerson: salesmanId,
          orderStatus: { $in: ['Confirmed', 'Processing', 'Dispatched', 'Delivered'] },
          orderDate: { $gte: startDate, $lte: endDate }
        }
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$grandTotal', 0] } } } }
    ]);
    return (result[0] && result[0].total != null) ? Number(result[0].total) : 0;
  }
  return 0;
};

// @desc    Get all sales targets
// @route   GET /api/admin/sales-targets
// @access  Private/Admin
const getSalesTargets = async (req, res) => {
  try {
    const { salesman, status, period, fromDate, toDate, search } = req.query;
    const filter = {};

    if (salesman && salesman !== 'All') {
      filter.salesman = salesman;
    }
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (period && period !== 'All') {
      filter.period = period;
    }
    if (fromDate || toDate) {
      filter.startDate = {};
      if (fromDate) {
        filter.startDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        filter.startDate.$lte = new Date(toDate);
      }
    }
    if (search) {
      filter.$or = [
        { targetName: { $regex: search, $options: 'i' } },
        { targetType: { $regex: search, $options: 'i' } },
      ];
    }

    const targets = await SalesTarget.find(filter)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Update progress, amount and fix status for each target
    const now = new Date();
    const data = [];
    for (const target of targets) {
      const progress = await calculateProgress(target);
      const currentAmount = await calculateOrderAmount(target);
      let needsSave = false;
      if (target.currentProgress !== progress) {
        target.currentProgress = progress;
        needsSave = true;
      }
      const endDate = new Date(target.endDate);
      endDate.setHours(23, 59, 59, 999);
      if (target.status === 'Failed' && now <= endDate) {
        target.status = 'Active';
        needsSave = true;
      }
      if (needsSave) await target.save();
      const obj = target.toObject ? target.toObject() : { ...target };
      obj.currentAmount = currentAmount;
      data.push(obj);
    }

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sales targets',
    });
  }
};

// @desc    Get single sales target
// @route   GET /api/admin/sales-targets/:id
// @access  Private/Admin
const getSalesTarget = async (req, res) => {
  try {
    const target = await SalesTarget.findById(req.params.id)
      .populate('salesman', 'name email phone')
      .populate('createdBy', 'name email');

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Sales target not found',
      });
    }

    // Update progress and fix status - ALWAYS recalculate to ensure accuracy
    const progress = await calculateProgress(target);
    let needsSave = false;
    
    // Always update progress (even if same) to ensure it's fresh
    if (target.currentProgress !== progress) {
      target.currentProgress = progress;
      needsSave = true;
    }
    
    const now = new Date();
    const endDate = new Date(target.endDate);
    endDate.setHours(23, 59, 59, 999);
    if (target.status === 'Failed' && now <= endDate) {
      target.status = 'Active';
      needsSave = true;
    }
    
    // Force save to ensure progress is always up-to-date
    if (needsSave || target.currentProgress !== progress) {
      target.currentProgress = progress;
      await target.save();
    }

    const currentAmount = await calculateOrderAmount(target);
    const responseData = target.toObject ? target.toObject() : { ...target };
    responseData.currentAmount = currentAmount;

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sales target',
    });
  }
};

// @desc    Create sales target
// @route   POST /api/admin/sales-targets
// @access  Private/Admin
const createSalesTarget = async (req, res) => {
  try {
    const {
      salesman,
      targetName,
      targetType,
      targetValue,
      period,
      startDate,
      endDate,
      notes,
    } = req.body;

    // Validate required fields
    if (!salesman) {
      return res.status(400).json({
        success: false,
        message: 'Please provide salesman',
      });
    }

    if (!targetName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide target name',
      });
    }

    if (!targetType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide target type',
      });
    }

    if (!targetValue || targetValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid target value',
      });
    }

    if (!period) {
      return res.status(400).json({
        success: false,
        message: 'Please provide period',
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start date and end date',
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date',
      });
    }

    // Verify salesman exists
    const salesmanUser = await User.findById(salesman);
    if (!salesmanUser || salesmanUser.role !== 'salesman') {
      return res.status(400).json({
        success: false,
        message: 'Invalid salesman selected',
      });
    }

    const target = await SalesTarget.create({
      salesman,
      approvalStatus: 'Approved', // Admin-created targets are approved by default
      approvedAt: new Date(),
      approvedBy: req.user._id,
      targetName,
      targetType,
      targetValue,
      period,
      startDate: start,
      endDate: end,
      notes: notes || undefined,
      currentProgress: 0,
      status: 'Active',
      createdBy: req.user._id,
    });

    const populatedTarget = await SalesTarget.findById(target._id)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Sales target created successfully',
      data: populatedTarget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating sales target',
    });
  }
};

// @desc    Update sales target
// @route   PUT /api/admin/sales-targets/:id
// @access  Private/Admin
const updateSalesTarget = async (req, res) => {
  try {
    const {
      targetName,
      targetType,
      targetValue,
      period,
      startDate,
      endDate,
      status,
      notes,
    } = req.body;

    const target = await SalesTarget.findById(req.params.id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Sales target not found',
      });
    }

    // Update fields
    // Approval flow (admin)
    const { approvalStatus, rejectionReason } = req.body;
    if (approvalStatus && approvalStatus !== target.approvalStatus) {
      if (approvalStatus === 'Approved') {
        target.approvalStatus = 'Approved';
        target.approvedAt = new Date();
        target.approvedBy = req.user._id;
        target.rejectedAt = undefined;
        target.rejectedBy = undefined;
        target.rejectionReason = undefined;
      } else if (approvalStatus === 'Rejected') {
        target.approvalStatus = 'Rejected';
        target.rejectedAt = new Date();
        target.rejectedBy = req.user._id;
        target.rejectionReason = rejectionReason || target.rejectionReason || '';
        target.approvedAt = undefined;
        target.approvedBy = undefined;
      } else if (approvalStatus === 'Pending') {
        target.approvalStatus = 'Pending';
        target.approvedAt = undefined;
        target.approvedBy = undefined;
        target.rejectedAt = undefined;
        target.rejectedBy = undefined;
        target.rejectionReason = undefined;
      }
    }

    if (targetName !== undefined) target.targetName = targetName;
    if (targetType !== undefined) target.targetType = targetType;
    if (targetValue !== undefined) target.targetValue = targetValue;
    if (period !== undefined) target.period = period;
    // Always update dates if provided (even if empty string, convert to null)
    if (startDate !== undefined) {
      target.startDate = startDate ? new Date(startDate) : null;
    }
    if (endDate !== undefined) {
      target.endDate = endDate ? new Date(endDate) : null;
    }
    if (status !== undefined) target.status = status;
    if (notes !== undefined) target.notes = notes;

    // Recalculate progress
    const progress = await calculateProgress(target);
    target.currentProgress = progress;

    await target.save();

    const populatedTarget = await SalesTarget.findById(target._id)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Sales target updated successfully',
      data: populatedTarget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating sales target',
    });
  }
};

// @desc    Delete sales target
// @route   DELETE /api/admin/sales-targets/:id
// @access  Private/Admin
const deleteSalesTarget = async (req, res) => {
  try {
    const target = await SalesTarget.findById(req.params.id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Sales target not found',
      });
    }

    await SalesTarget.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Sales target deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting sales target',
    });
  }
};

module.exports = {
  getSalesTargets,
  getSalesTarget,
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
};
