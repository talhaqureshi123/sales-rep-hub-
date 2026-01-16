const SalesTarget = require('../../database/models/SalesTarget');
const User = require('../../database/models/User');
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
    if (targetName) target.targetName = targetName;
    if (targetType) target.targetType = targetType;
    if (targetValue !== undefined) target.targetValue = targetValue;
    if (period) target.period = period;
    if (startDate) target.startDate = new Date(startDate);
    if (endDate) target.endDate = new Date(endDate);
    if (status) target.status = status;
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
