const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomersBySalesman,
} = require('../controllers/customerController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.route('/').get(getCustomers).post(createCustomer);
router.route('/salesman/:salesmanId').get(getCustomersBySalesman);
router.route('/:id').get(getCustomer).put(updateCustomer).delete(deleteCustomer);

module.exports = router;


