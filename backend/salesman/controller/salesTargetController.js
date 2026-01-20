const SalesTarget = require('../../database/models/SalesTarget');
const SalesOrder = require('../../database/models/SalesOrder');
const Quotation = require('../../database/models/Quotation');
const VisitTarget = require('../../database/models/VisitTarget');
const Customer = require('../../database/models/Customer');

// Helper function to calculate progress based on target type
const calculateProgress = async (target) => {
  const startDate = new Date(target.startDate);
  const endDate = new Date(target.endDate);
  
  switch (target.targetType) {
    case 'Revenue':
      // Calculate from sales orders
      const orders = await SalesOrder.find({
        salesPerson: target.salesman,
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: { $ne: 'Draft' },
      });
      return orders.reduce((sum, order) => sum + (order.grandTotal || 0), 0);
    
    case 'Visits':
      // Calculate from visit targets
      const visits = await VisitTarget.countDocuments({
        salesman: target.salesman,
        visitDate: { $gte: startDate, $lte: endDate },
        status: 'Completed',
      });
      return visits;
    
    case 'New Customers':
      // Calculate new customers created in period
      const customers = await Customer.countDocuments({
        assignedSalesman: target.salesman,
        createdAt: { $gte: startDate, $lte: endDate },
      });
      return customers;
    
    case 'Quotes':
      // Calculate quotations created
      const quotes = await Quotation.countDocuments({
        salesman: target.salesman,
        createdAt: { $gte: startDate, $lte: endDate },
      });
      return quotes;
    
    case 'Conversions':
      // Calculate quotations converted to orders
      const convertedQuotes = await Quotation.countDocuments({
        salesman: target.salesman,
        status: 'Approved',
        updatedAt: { $gte: startDate, $lte: endDate },
      });
      return convertedQuotes;
    
    case 'Orders':
      // Calculate orders created
      const orderCount = await SalesOrder.countDocuments({
        salesPerson: target.salesman,
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: { $ne: 'Draft' },
      });
      return orderCount;
    
    default:
      return 0;
  }
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

    const targets = await SalesTarget.find(filter)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Update progress for each target
    for (const target of targets) {
      const progress = await calculateProgress(target);
      if (target.currentProgress !== progress) {
        target.currentProgress = progress;
        await target.save();
      }
    }

    res.status(200).json({
      success: true,
      count: targets.length,
      data: targets,
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

    // Update progress
    const progress = await calculateProgress(target);
    if (target.currentProgress !== progress) {
      target.currentProgress = progress;
      await target.save();
    }

    res.status(200).json({
      success: true,
      data: target,
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
