const express = require('express');
const router = express.Router();
const {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
} = require('../controller/quotationController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.route('/').get(getQuotations).post(createQuotation);
router.route('/:id').get(getQuotation).put(updateQuotation).delete(deleteQuotation);

module.exports = router;


