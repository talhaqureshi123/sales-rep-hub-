const SalesTarget = require('../../database/models/SalesTarget');
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

// @desc    Get my sales targets (assigned to logged-in salesman)
// @route   GET /api/salesman/sales-targets
// @access  Private/Salesman
const getMySalesTargets = async (req, res) => {
  try {
    const { status, period, targetType } = req.query;
    const filter = { salesman: req.user._id };

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (period && period !== 'All') {
      filter.period = period;
    }
    if (targetType && targetType !== 'All') {
      filter.targetType = targetType;
    }
    
    // Only show approved sales targets to salesman (similar to visit targets)
    filter.$or = [
      { approvalStatus: 'Approved' },
      { approvalStatus: { $exists: false } }, // Backward compatibility
    ];

    const targets = await SalesTarget.find(filter)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

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

// @desc    Get single sales target (assigned to logged-in salesman)
// @route   GET /api/salesman/sales-targets/:id
// @access  Private/Salesman
const getMySalesTarget = async (req, res) => {
  try {
    const target = await SalesTarget.findOne({
      _id: req.params.id,
      salesman: req.user._id, // Ensure salesman can only access their own targets
    })
      .populate('salesman', 'name email phone')
      .populate('createdBy', 'name email');

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Sales target not found or you do not have access to it',
      });
    }

    // Update progress and fix status
    const progress = await calculateProgress(target);
    let needsSave = false;
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
    if (needsSave) await target.save();

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

// @desc    Get sales target statistics for logged-in salesman
// @route   GET /api/salesman/sales-targets/stats
// @access  Private/Salesman
const getMySalesTargetStats = async (req, res) => {
  try {
    const targets = await SalesTarget.find({ salesman: req.user._id });

    const stats = {
      total: targets.length,
      active: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalTargetValue: 0,
      totalProgress: 0,
      byType: {},
    };

    for (const target of targets) {
      // Update progress
      const progress = await calculateProgress(target);
      if (target.currentProgress !== progress) {
        target.currentProgress = progress;
        await target.save();
      }

      // Count by status
      if (target.status === 'Active') stats.active++;
      else if (target.status === 'Completed') stats.completed++;
      else if (target.status === 'Failed') stats.failed++;
      else if (target.status === 'Cancelled') stats.cancelled++;

      // Sum values
      stats.totalTargetValue += target.targetValue || 0;
      stats.totalProgress += target.currentProgress || 0;

      // Count by type
      if (!stats.byType[target.targetType]) {
        stats.byType[target.targetType] = {
          count: 0,
          targetValue: 0,
          progress: 0,
        };
      }
      stats.byType[target.targetType].count++;
      stats.byType[target.targetType].targetValue += target.targetValue || 0;
      stats.byType[target.targetType].progress += target.currentProgress || 0;
    }

    // Calculate overall completion percentage
    stats.completionPercentage = stats.totalTargetValue > 0
      ? ((stats.totalProgress / stats.totalTargetValue) * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sales target statistics',
    });
  }
};

module.exports = {
  getMySalesTargets,
  getMySalesTarget,
  getMySalesTargetStats,
};
