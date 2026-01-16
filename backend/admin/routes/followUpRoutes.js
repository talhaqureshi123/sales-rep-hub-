const express = require('express');
const router = express.Router();
const {
  getFollowUps,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  getFollowUpStats,
} = require('../controllers/followUpController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getFollowUpStats);
router.route('/').get(getFollowUps).post(createFollowUp);
router.route('/:id').get(getFollowUp).put(updateFollowUp).delete(deleteFollowUp);

module.exports = router;
