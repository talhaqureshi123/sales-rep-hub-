const express = require('express');
const router = express.Router();
const {
  getSalesTargets,
  getSalesTarget,
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
} = require('../controllers/salesTargetController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router
  .route('/')
  .get(getSalesTargets)
  .post(createSalesTarget);

router
  .route('/:id')
  .get(getSalesTarget)
  .put(updateSalesTarget)
  .delete(deleteSalesTarget);

module.exports = router;
