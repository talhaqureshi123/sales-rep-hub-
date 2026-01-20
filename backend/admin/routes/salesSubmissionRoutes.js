const express = require('express');
const router = express.Router();
const {
  getSalesSubmissions,
  getSalesSubmission,
  approveSalesSubmission,
  rejectSalesSubmission,
  getSalesSubmissionStats,
} = require('../controllers/salesSubmissionController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getSalesSubmissionStats);
router.put('/:id/approve', approveSalesSubmission);
router.put('/:id/reject', rejectSalesSubmission);
router.route('/').get(getSalesSubmissions);
router.route('/:id').get(getSalesSubmission);

module.exports = router;
