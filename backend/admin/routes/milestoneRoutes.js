/* COMMENTED OUT - MILESTONE FUNCTIONALITY DISABLED
const express = require('express');
const router = express.Router();
const {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getSalesmen,
} = require('../controllers/milestoneController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/salesmen', getSalesmen);
router.route('/').get(getMilestones).post(createMilestone);
router.route('/:id').put(updateMilestone).delete(deleteMilestone);

module.exports = router;
*/

// Return empty router to prevent errors
const express = require('express');
const router = express.Router();
module.exports = router;
