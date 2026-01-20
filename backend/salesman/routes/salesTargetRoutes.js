const express = require('express');
const router = express.Router();
const {
  getMySalesTargets,
  getMySalesTarget,
  getMySalesTargetStats,
} = require('../controller/salesTargetController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.get('/stats', getMySalesTargetStats);
router.route('/').get(getMySalesTargets);
router.route('/:id').get(getMySalesTarget);

module.exports = router;
