const FollowUp = require('../../database/models/FollowUp');

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

    const followUps = await FollowUp.find(filter)
      .populate('customer', 'name email phone')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName')
      .populate('visitTarget', 'name address status visitDate')
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
      .populate('customer', 'name email phone address')
      .populate('relatedQuotation', 'quotationNumber total status')
      .populate('relatedSample', 'sampleNumber productName status')
      .populate('visitTarget', 'name address city status visitDate');

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

    // Salesman can only mark as Completed (or leave as-is)
    if (status && status === 'Completed') {
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
  updateMyFollowUp,
};

