const FollowUp = require('../../database/models/FollowUp');
const hubspotService = require('../../services/hubspotService');

// @desc    Get follow-ups assigned to logged-in salesman
// @route   GET /api/salesman/follow-ups
// @access  Private/Salesman
const getMyFollowUps = async (req, res) => {
  try {
    const { status, type, priority, search } = req.query;
    const filter = { salesman: req.user._id };

    if (status && status !== 'All') filter.status = status;
    if (type && type !== 'All') filter.type = type;
    if (priority && priority !== 'All') filter.priority = priority;
    if (search) {
      filter.$or = [
        { followUpNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Salesman can see all tasks assigned to them (including admin-created and their own)
    // No need to filter by approvalStatus - show all (Pending, Approved, Rejected)

    const followUps = await FollowUp.find(filter)
      .populate('customer', 'name email phone company')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName')
      .populate('visitTarget', 'name address status visitDate')
      .populate('createdBy', 'name email role')
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

// @desc    Get single follow-up (salesman-owned)
// @route   GET /api/salesman/follow-ups/:id
// @access  Private/Salesman
const getMyFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    })
      .populate('customer', 'name email phone address company')
      .populate('relatedQuotation', 'quotationNumber total status')
      .populate('relatedSample', 'sampleNumber productName status')
      .populate('visitTarget', 'name address city status visitDate')
      .populate('createdBy', 'name email role');

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
        message: 'Please provide all required fields (customerName, type, dueDate)',
      });
    }

    const followUp = await FollowUp.create({
      salesman: req.user._id, // Always use logged-in salesman
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
      approvalStatus: 'Pending', // Salesman tasks need admin approval
    });

    // ❌ NO HUBSPOT SYNC - Will be posted to HubSpot only after admin approval

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('customer', 'name email phone company')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName');

    res.status(201).json({
      success: true,
      message: 'Follow-up created successfully. It will also be posted to HubSpot.',
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating follow-up',
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
        message: 'Follow-up not found',
      });
    }

    if (notes !== undefined) followUp.notes = notes;

    // Salesman can only mark as Completed if task is approved
    if (status && status === 'Completed') {
      if (followUp.approvalStatus !== 'Approved') {
        return res.status(400).json({
          success: false,
          message: 'Cannot complete task. Task must be approved first.',
        });
      }
      followUp.status = 'Completed';
      if (!followUp.completedDate) {
        followUp.completedDate = completedDate || new Date();
      }
    }

    await followUp.save();

    res.status(200).json({
      success: true,
      message: 'Follow-up updated successfully',
      data: followUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating follow-up',
    });
  }
};

module.exports = {
  getMyFollowUps,
  getMyFollowUp,
  createMyFollowUp,
  updateMyFollowUp,
};

