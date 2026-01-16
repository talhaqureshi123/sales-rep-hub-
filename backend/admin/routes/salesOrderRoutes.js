const express = require('express');
const router = express.Router();
const {
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
} = require('../controllers/salesOrderController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router
  .route('/')
  .get(getSalesOrders)
  .post(createSalesOrder);

router
  .route('/:id')
  .get(getSalesOrder)
  .put(updateSalesOrder)
  .delete(deleteSalesOrder);

module.exports = router;
