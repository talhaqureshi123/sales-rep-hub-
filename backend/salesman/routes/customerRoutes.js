const express = require('express');
const router = express.Router();
const {
  getMyCustomers,
  getCustomer,
  createCustomer,
} = require('../controller/customerController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.route('/')
  .get(getMyCustomers)
  .post(createCustomer);
router.route('/:id').get(getCustomer);

module.exports = router;


