const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductByCode,
  getProduct,
} = require('../controller/productController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.get('/', getProducts);
router.get('/code/:code', getProductByCode);
router.get('/:id', getProduct);

module.exports = router;


