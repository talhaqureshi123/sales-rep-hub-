const express = require('express');
const router = express.Router();
const {
  getVisitTargets,
  getVisitTarget,
  createVisitTarget,
  updateVisitTarget,
  deleteVisitTarget,
  getVisitTargetsBySalesman,
  getSalesmanTargetStats,
} = require('../controllers/visitTargetController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Specific routes must come before parameterized routes
router.route('/salesman/:salesmanId').get(getVisitTargetsBySalesman);
router.route('/salesman/:salesmanId/stats').get(getSalesmanTargetStats);
router.route('/').get(getVisitTargets).post(createVisitTarget);
router.route('/:id').get(getVisitTarget).put(updateVisitTarget).delete(deleteVisitTarget);

module.exports = router;

