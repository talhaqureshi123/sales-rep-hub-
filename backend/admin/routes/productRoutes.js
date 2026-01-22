const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  downloadQRCode,
  downloadBarcode,
} = require('../controllers/productController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProduct).put(updateProduct).delete(deleteProduct);
router.route('/:id/qr-code').get(downloadQRCode);
router.route('/:id/barcode').get(downloadBarcode);

module.exports = router;


