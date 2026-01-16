const express = require('express');
const router = express.Router();
const {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  getQuotationStats,
} = require('../controllers/quotationController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getQuotationStats);
router.route('/').get(getQuotations).post(createQuotation);
router.route('/:id').get(getQuotation).put(updateQuotation).delete(deleteQuotation);

module.exports = router;
