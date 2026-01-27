const express = require('express');
const router = express.Router();
const {
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
  approveSalesOrder,
  rejectSalesOrder,
} = require('../controllers/salesOrderController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication - allow both admin and salesman
router.use(protect);
router.use(authorize('admin', 'salesman'));

router
  .route('/')
  .get(getSalesOrders)
  .post(createSalesOrder);

router
  .route('/:id')
  .get(getSalesOrder)
  .put(updateSalesOrder)
  .delete(deleteSalesOrder);

router
  .route('/:id/approve')
  .put(approveSalesOrder);

router
  .route('/:id/reject')
  .put(rejectSalesOrder);

module.exports = router;
