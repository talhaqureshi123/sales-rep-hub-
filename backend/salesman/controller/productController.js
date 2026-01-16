const Product = require('../../database/models/Product');

// @desc    Get all active products
// @route   GET /api/salesman/products
// @access  Private/Salesman
const getProducts = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = { isActive: true };

    if (category) {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productCode: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(filter).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching products',
    });
  }
};

// @desc    Get product by code
// @route   GET /api/salesman/products/code/:code
// @access  Private/Salesman
const getProductByCode = async (req, res) => {
  try {
    const product = await Product.findOne({
      productCode: req.params.code.toUpperCase(),
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching product',
    });
  }
};

// @desc    Get single product
// @route   GET /api/salesman/products/:id
// @access  Private/Salesman
const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching product',
    });
  }
};

module.exports = {
  getProducts,
  getProductByCode,
  getProduct,
};


