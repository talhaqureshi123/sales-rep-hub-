const FollowUp = require('../../database/models/FollowUp');
const VisitTarget = require('../../database/models/VisitTarget');

const TASKS_LIST_LIMIT = 80; // Small cap for fast first paint – list shows quickly

// @desc    Get tasks list for admin (follow-ups + visit targets) in one call – minimal populates, fast
// @route   GET /api/admin/tasks-list
// @access  Private/Admin
const getTasksList = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || TASKS_LIST_LIMIT, 200);

    // Only salesman + createdBy (no customer/visitTarget) – list uses customerName from doc
    const [followUps, visitTargets] = await Promise.all([
      FollowUp.find({})
        .select('followUpNumber customerName customerEmail type priority status dueDate salesman createdBy approvalStatus createdAt visitTarget hubspotTaskId')
        .populate('salesman', 'name email')
        .populate('createdBy', 'name email role')
        .sort({ dueDate: 1, priority: -1 })
        .limit(limit)
        .lean(),
      VisitTarget.find({})
        .select('name customerName address city visitDate status approvalStatus salesman createdBy createdAt priority')
        .populate('salesman', 'name email')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        followUps,
        visitTargets,
      },
    });
  } catch (error) {
    console.error('Error fetching tasks list:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching tasks list',
    });
  }
};

module.exports = {
  getTasksList,
};
