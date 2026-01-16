const FollowUp = require('../../database/models/FollowUp');
const User = require('../../database/models/User');
const Customer = require('../../database/models/Customer');
const hubspotService = require('../../services/hubspotService');

// @desc    Get all follow-ups
// @route   GET /api/admin/follow-ups
// @access  Private/Admin
const getFollowUps = async (req, res) => {
  try {
    const { salesman, status, type, priority, search, startDate, endDate, source } = req.query;
    const filter = {};

    if (salesman) {
      filter.salesman = salesman;
    }
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (type && type !== 'All') {
      filter.type = type;
    }
    if (priority && priority !== 'All') {
      filter.priority = priority;
    }
    if (search) {
      filter.$or = [
        { followUpNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      filter.dueDate = {};
      if (startDate) {
        filter.dueDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.dueDate.$lte = new Date(endDate);
      }
    }

    // Filter imported HubSpot tasks only
    if (source === 'hubspot') {
      filter.hubspotTaskId = { $exists: true, $ne: '' };
    }

    const followUps = await FollowUp.find(filter)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName')
      .populate('visitTarget', 'name address')
      .sort({ dueDate: 1, priority: -1 });

    res.status(200).json({
      success: true,
      count: followUps.length,
      data: followUps,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching follow-ups',
    });
  }
};

// @desc    Get single follow-up
// @route   GET /api/admin/follow-ups/:id
// @access  Private/Admin
const getFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id)
      .populate('salesman', 'name email phone')
      .populate('customer', 'name email phone address')
      .populate('relatedQuotation', 'quotationNumber total status')
      .populate('relatedSample', 'sampleNumber productName status')
      .populate('visitTarget', 'name address city');

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    res.status(200).json({
      success: true,
      data: followUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching follow-up',
    });
  }
};

// @desc    Create follow-up
// @route   POST /api/admin/follow-ups
// @access  Private/Admin
const createFollowUp = async (req, res) => {
  try {
    const {
      salesman,
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

    if (!salesman || !customerName || !type || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    const followUp = await FollowUp.create({
      salesman,
      customer,
      customerName,
      customerEmail,
      customerPhone,
      type,
      priority: priority || 'Medium',
      scheduledDate: scheduledDate || dueDate,
      dueDate,
      description,
      notes,
      relatedQuotation,
      relatedSample,
      relatedOrder,
      visitTarget,
      createdBy: req.user._id,
    });

    // 🔁 HUBSPOT SYNC (NON-BLOCKING): create task in HubSpot when follow-up is created
    (async () => {
      try {
        const subject = description || `Follow-up: ${customerName}`;
        const body = notes || '';

        // Map local priority to HubSpot priority values
        let hsPriority = 'NONE';
        const pr = (priority || followUp.priority || '').toLowerCase();
        if (pr === 'urgent' || pr === 'high') hsPriority = 'HIGH';
        else if (pr === 'medium') hsPriority = 'MEDIUM';
        else if (pr === 'low') hsPriority = 'LOW';

        const hubspotTaskId = await hubspotService.createTaskObjectInHubSpot({
          subject,
          body,
          status: 'NOT_STARTED',
          priority: hsPriority,
          type: 'TODO',
          dueDate: followUp.dueDate,
        });

        if (hubspotTaskId) {
          followUp.hubspotTaskId = hubspotTaskId;
          await followUp.save();
        }
      } catch (e) {
        console.error('HubSpot follow-up task sync error (non-blocking):', e.message);
      }
    })();

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName');

    res.status(201).json({
      success: true,
      message: 'Follow-up created successfully',
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating follow-up',
    });
  }
};

// @desc    Update follow-up
// @route   PUT /api/admin/follow-ups/:id
// @access  Private/Admin
const updateFollowUp = async (req, res) => {
  try {
    const {
      status,
      type,
      priority,
      scheduledDate,
      dueDate,
      description,
      notes,
      completedDate,
    } = req.body;

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    if (status) {
      followUp.status = status;
      if (status === 'Completed' && !followUp.completedDate) {
        followUp.completedDate = completedDate || new Date();
      }
    }
    if (type) followUp.type = type;
    if (priority) followUp.priority = priority;
    if (scheduledDate) followUp.scheduledDate = scheduledDate;
    if (dueDate) followUp.dueDate = dueDate;
    if (description !== undefined) followUp.description = description;
    if (notes !== undefined) followUp.notes = notes;

    await followUp.save();

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName');

    res.status(200).json({
      success: true,
      message: 'Follow-up updated successfully',
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating follow-up',
    });
  }
};

// @desc    Delete follow-up
// @route   DELETE /api/admin/follow-ups/:id
// @access  Private/Admin
const deleteFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    await FollowUp.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Follow-up deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting follow-up',
    });
  }
};

// @desc    Get follow-up statistics
// @route   GET /api/admin/follow-ups/stats
// @access  Private/Admin
const getFollowUpStats = async (req, res) => {
  try {
    const totalFollowUps = await FollowUp.countDocuments();
    const overdueFollowUps = await FollowUp.countDocuments({ status: 'Overdue' });
    const todayFollowUps = await FollowUp.countDocuments({ status: 'Today' });
    const upcomingFollowUps = await FollowUp.countDocuments({ status: 'Upcoming' });
    const completedFollowUps = await FollowUp.countDocuments({ status: 'Completed' });

    res.status(200).json({
      success: true,
      data: {
        total: totalFollowUps,
        overdue: overdueFollowUps,
        today: todayFollowUps,
        upcoming: upcomingFollowUps,
        completed: completedFollowUps,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching follow-up statistics',
    });
  }
};

module.exports = {
  getFollowUps,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  getFollowUpStats,
};
