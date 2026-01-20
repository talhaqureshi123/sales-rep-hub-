const express = require('express');
const router = express.Router();
const {
  getMySalesSubmissions,
  getMySalesSubmission,
  createSalesSubmission,
  updateMySalesSubmission,
  deleteMySalesSubmission,
  getMySalesSubmissionStats,
} = require('../controller/salesSubmissionController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.get('/stats', getMySalesSubmissionStats);
router.route('/').get(getMySalesSubmissions).post(createSalesSubmission);
router.route('/:id').get(getMySalesSubmission).put(updateMySalesSubmission).delete(deleteMySalesSubmission);

module.exports = router;
