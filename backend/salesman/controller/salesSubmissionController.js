const SalesSubmission = require('../../database/models/SalesSubmission');
const Customer = require('../../database/models/Customer');

// @desc    Get my sales submissions
// @route   GET /api/salesman/sales-submissions
// @access  Private/Salesman
const getMySalesSubmissions = async (req, res) => {
  try {
    const { status, fromDate, toDate } = req.query;
    const filter = { salesman: req.user._id };

    if (status && status !== 'All') {
      filter.approvalStatus = status;
    }
    if (fromDate) {
      filter.salesDate = { ...filter.salesDate, $gte: new Date(fromDate) };
    }
    if (toDate) {
      filter.salesDate = { ...filter.salesDate, $lte: new Date(toDate) };
    }

    const submissions = await SalesSubmission.find(filter)
      .populate('customer', 'firstName lastName email phone')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sales submissions',
    });
  }
};

// @desc    Get single sales submission
// @route   GET /api/salesman/sales-submissions/:id
// @access  Private/Salesman
const getMySalesSubmission = async (req, res) => {
  try {
    const submission = await SalesSubmission.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    })
      .populate('customer', 'firstName lastName email phone address')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('createdBy', 'name email');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sales submission not found or you do not have access to it',
      });
    }

    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sales submission',
    });
  }
};

// @desc    Create sales submission
// @route   POST /api/salesman/sales-submissions
// @access  Private/Salesman
const createSalesSubmission = async (req, res) => {
  try {
    const {
      customer,
      customerName,
      customerEmail,
      customerPhone,
      salesDate,
      salesAmount,
      salesDescription,
      documents,
    } = req.body;

    // Validation
    if (!customerName || !salesDate || !salesAmount) {
      return res.status(400).json({
        success: false,
        message: 'Please provide customer name, sales date, and sales amount',
      });
    }

    if (salesAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Sales amount must be greater than 0',
      });
    }

    // If customer ID provided, verify it exists
    if (customer) {
      const customerExists = await Customer.findById(customer);
      if (!customerExists) {
        return res.status(400).json({
          success: false,
          message: 'Customer not found',
        });
      }
    }

    const submission = await SalesSubmission.create({
      salesman: req.user._id,
      customer,
      customerName,
      customerEmail,
      customerPhone,
      salesDate: new Date(salesDate),
      salesAmount,
      salesDescription,
      documents: documents || [],
      approvalStatus: 'Pending',
      createdBy: req.user._id,
    });

    const populatedSubmission = await SalesSubmission.findById(submission._id)
      .populate('customer', 'firstName lastName email phone')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Sales submission created successfully. Waiting for admin approval.',
      data: populatedSubmission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating sales submission',
    });
  }
};

// @desc    Update sales submission (only if pending)
// @route   PUT /api/salesman/sales-submissions/:id
// @access  Private/Salesman
const updateMySalesSubmission = async (req, res) => {
  try {
    const submission = await SalesSubmission.findOne({
      _id: req.params.id,
      salesman: req.user._id,
      approvalStatus: 'Pending', // Can only update pending submissions
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sales submission not found, already approved/rejected, or you do not have access',
      });
    }

    const {
      customerName,
      customerEmail,
      customerPhone,
      salesDate,
      salesAmount,
      salesDescription,
      documents,
    } = req.body;

    if (customerName) submission.customerName = customerName;
    if (customerEmail) submission.customerEmail = customerEmail;
    if (customerPhone) submission.customerPhone = customerPhone;
    if (salesDate) submission.salesDate = new Date(salesDate);
    if (salesAmount !== undefined) {
      if (salesAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Sales amount must be greater than 0',
        });
      }
      submission.salesAmount = salesAmount;
    }
    if (salesDescription !== undefined) submission.salesDescription = salesDescription;
    if (documents) submission.documents = documents;

    await submission.save();

    const populatedSubmission = await SalesSubmission.findById(submission._id)
      .populate('customer', 'firstName lastName email phone')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Sales submission updated successfully',
      data: populatedSubmission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating sales submission',
    });
  }
};

// @desc    Delete sales submission (only if pending)
// @route   DELETE /api/salesman/sales-submissions/:id
// @access  Private/Salesman
const deleteMySalesSubmission = async (req, res) => {
  try {
    const submission = await SalesSubmission.findOne({
      _id: req.params.id,
      salesman: req.user._id,
      approvalStatus: 'Pending', // Can only delete pending submissions
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sales submission not found, already approved/rejected, or you do not have access',
      });
    }

    await SalesSubmission.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Sales submission deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting sales submission',
    });
  }
};

// @desc    Get sales submission statistics
// @route   GET /api/salesman/sales-submissions/stats
// @access  Private/Salesman
const getMySalesSubmissionStats = async (req, res) => {
  try {
    const submissions = await SalesSubmission.find({ salesman: req.user._id });

    const stats = {
      total: submissions.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
      approvedAmount: 0,
      pendingAmount: 0,
    };

    submissions.forEach((sub) => {
      if (sub.approvalStatus === 'Pending') stats.pending++;
      else if (sub.approvalStatus === 'Approved') stats.approved++;
      else if (sub.approvalStatus === 'Rejected') stats.rejected++;

      stats.totalAmount += sub.salesAmount || 0;
      if (sub.approvalStatus === 'Approved') {
        stats.approvedAmount += sub.salesAmount || 0;
      } else if (sub.approvalStatus === 'Pending') {
        stats.pendingAmount += sub.salesAmount || 0;
      }
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sales submission statistics',
    });
  }
};

module.exports = {
  getMySalesSubmissions,
  getMySalesSubmission,
  createSalesSubmission,
  updateMySalesSubmission,
  deleteMySalesSubmission,
  getMySalesSubmissionStats,
};
