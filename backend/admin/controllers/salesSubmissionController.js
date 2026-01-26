const SalesSubmission = require('../../database/models/SalesSubmission');
const User = require('../../database/models/User');
const SalesTarget = require('../../database/models/SalesTarget');

// @desc    Get all sales submissions
// @route   GET /api/admin/sales-submissions
// @access  Private/Admin
const getSalesSubmissions = async (req, res) => {
  try {
    const { salesman, status, fromDate, toDate, search } = req.query;
    const filter = {};

    if (salesman && salesman !== 'All') {
      filter.salesman = salesman;
    }
    if (status && status !== 'All') {
      filter.approvalStatus = status;
    }
    if (fromDate || toDate) {
      filter.salesDate = {};
      if (fromDate) filter.salesDate.$gte = new Date(fromDate);
      if (toDate) filter.salesDate.$lte = new Date(toDate);
    }
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { submissionNumber: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const submissions = await SalesSubmission.find(filter)
      .populate('salesman', 'name email phone')
      .populate('customer', 'firstName lastName email phone')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('createdBy', 'name email')
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
// @route   GET /api/admin/sales-submissions/:id
// @access  Private/Admin
const getSalesSubmission = async (req, res) => {
  try {
    const submission = await SalesSubmission.findById(req.params.id)
      .populate('salesman', 'name email phone')
      .populate('customer', 'firstName lastName email phone address')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('createdBy', 'name email');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sales submission not found',
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

// @desc    Approve sales submission
// @route   PUT /api/admin/sales-submissions/:id/approve
// @access  Private/Admin
const approveSalesSubmission = async (req, res) => {
  try {
    const { adminNotes } = req.body;

    const submission = await SalesSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sales submission not found',
      });
    }

    if (submission.approvalStatus === 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Sales submission is already approved',
      });
    }

    submission.approvalStatus = 'Approved';
    submission.approvedBy = req.user._id;
    submission.approvedAt = new Date();
    if (adminNotes) submission.adminNotes = adminNotes;

    await submission.save();

    // Update sales targets automatically when submission is approved
    try {
      const salesDate = new Date(submission.salesDate);
      const salesAmount = submission.salesAmount || 0;
      
      // Find all active Revenue targets for this salesman that include the sales date
      const activeRevenueTargets = await SalesTarget.find({
        salesman: submission.salesman,
        targetType: 'Revenue',
        status: 'Active',
        startDate: { $lte: salesDate },
        endDate: { $gte: salesDate }
      });

      // Update each matching target's currentProgress
      for (const target of activeRevenueTargets) {
        target.currentProgress = (target.currentProgress || 0) + salesAmount;
        await target.save();
      }

      console.log(`✅ Sales submission approved: ₹${salesAmount} added to ${activeRevenueTargets.length} sales target(s) for salesman ${submission.salesman}`);
    } catch (targetError) {
      console.error('Error updating sales targets:', targetError);
      // Don't fail the approval if target update fails
    }

    const populatedSubmission = await SalesSubmission.findById(submission._id)
      .populate('salesman', 'name email')
      .populate('approvedBy', 'name email')
      .populate('customer', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: 'Sales submission approved successfully',
      data: populatedSubmission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error approving sales submission',
    });
  }
};

// @desc    Reject sales submission
// @route   PUT /api/admin/sales-submissions/:id/reject
// @access  Private/Admin
const rejectSalesSubmission = async (req, res) => {
  try {
    const { rejectionReason, adminNotes } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rejection reason',
      });
    }

    const submission = await SalesSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sales submission not found',
      });
    }

    if (submission.approvalStatus === 'Rejected') {
      return res.status(400).json({
        success: false,
        message: 'Sales submission is already rejected',
      });
    }

    submission.approvalStatus = 'Rejected';
    submission.rejectedBy = req.user._id;
    submission.rejectedAt = new Date();
    submission.rejectionReason = rejectionReason;
    if (adminNotes) submission.adminNotes = adminNotes;

    await submission.save();

    const populatedSubmission = await SalesSubmission.findById(submission._id)
      .populate('salesman', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('customer', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: 'Sales submission rejected',
      data: populatedSubmission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting sales submission',
    });
  }
};

// @desc    Get sales submission statistics
// @route   GET /api/admin/sales-submissions/stats
// @access  Private/Admin
const getSalesSubmissionStats = async (req, res) => {
  try {
    const submissions = await SalesSubmission.find()
      .populate('salesman', 'name email');

    const stats = {
      total: submissions.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
      approvedAmount: 0,
      pendingAmount: 0,
      bySalesman: {},
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

      // By salesman
      const salesmanId = sub.salesman?._id?.toString() || 'unknown';
      if (!stats.bySalesman[salesmanId]) {
        stats.bySalesman[salesmanId] = {
          name: sub.salesman?.name || 'Unknown',
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          totalAmount: 0,
          approvedAmount: 0,
        };
      }
      stats.bySalesman[salesmanId].total++;
      if (sub.approvalStatus === 'Approved') stats.bySalesman[salesmanId].approved++;
      else if (sub.approvalStatus === 'Pending') stats.bySalesman[salesmanId].pending++;
      else if (sub.approvalStatus === 'Rejected') stats.bySalesman[salesmanId].rejected++;
      stats.bySalesman[salesmanId].totalAmount += sub.salesAmount || 0;
      if (sub.approvalStatus === 'Approved') {
        stats.bySalesman[salesmanId].approvedAmount += sub.salesAmount || 0;
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
  getSalesSubmissions,
  getSalesSubmission,
  approveSalesSubmission,
  rejectSalesSubmission,
  getSalesSubmissionStats,
};
