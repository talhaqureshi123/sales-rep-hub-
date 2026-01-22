const Product = require("../../database/models/Product");

// @desc    Get all products
// @route   GET /api/admin/products
// @access  Private/Admin
const getProducts = async (req, res) => {
  try {
    const { category, isActive, search } = req.query;
    const filter = {};

    if (category) {
      filter.category = category;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { productCode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching products",
    });
  }
};

// @desc    Get single product
// @route   GET /api/admin/products/:id
// @access  Private/Admin
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching product",
    });
  }
};

// @desc    Create product
// @route   POST /api/admin/products
// @access  Private/Admin
// @desc    Create product
// @route   POST /api/admin/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const {
      productCode,
      name,
      description,
      price,
      category,
      stock,
      image,
      imageUrl, // Accept imageUrl as well
      keyFeatures,
      isActive,
    } = req.body;

    // Check if product code already exists
    const finalProductCode = productCode ? productCode.toUpperCase() : null;
    if (finalProductCode) {
      const productExists = await Product.findOne({
        productCode: finalProductCode,
      });
      if (productExists) {
        return res.status(400).json({
          success: false,
          message: "Product with this code already exists",
        });
      }
    }

    // Create product first to get the ID
    const productData = {
      productCode: finalProductCode,
      name,
      description,
      price,
      category,
      stock,
      image: image || imageUrl || "", // Accept both image and imageUrl
      keyFeatures: keyFeatures || [],
      isActive,
    };

    const product = await Product.create(productData);

    // Generate QR code with full product details in JSON format
    const qrCodeData = {
      productCode: product.productCode,
      name: product.name,
      description: product.description || "",
      price: product.price,
      category: product.category,
      stock: product.stock,
      image: product.image || "",
      keyFeatures: product.keyFeatures || [],
      productId: product._id.toString(),
      timestamp: new Date().toISOString(),
    };

    // Encode product details as JSON string for QR code
    const qrDataString = JSON.stringify(qrCodeData);
    const qrCodeURL = finalProductCode
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          qrDataString
        )}`
      : null;

    // Update product with QR code URL
    product.qrCode = qrCodeURL;
    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error creating product",
    });
  }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const {
      productCode,
      name,
      description,
      price,
      category,
      stock,
      image,
      qrCode,
      keyFeatures,
      isActive,
    } = req.body;

    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if product code is being changed and if it already exists
    if (productCode && productCode.toUpperCase() !== product.productCode) {
      const codeExists = await Product.findOne({
        productCode: productCode.toUpperCase(),
      });
      if (codeExists) {
        return res.status(400).json({
          success: false,
          message: "Product code already exists",
        });
      }
    }

    // Update fields
    if (productCode) product.productCode = productCode.toUpperCase();
    if (name) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (category) product.category = category;
    if (stock !== undefined) product.stock = stock;
    if (image !== undefined) product.image = image;
    if (isActive !== undefined) product.isActive = isActive;
    if (keyFeatures !== undefined) product.keyFeatures = keyFeatures;

    await product.save();

    // Regenerate QR code with updated product details (always update QR code when product is updated)
    const qrCodeData = {
      productCode: product.productCode,
      name: product.name,
      description: product.description || "",
      price: product.price,
      category: product.category,
      stock: product.stock,
      image: product.image || "",
      keyFeatures: product.keyFeatures || [],
      productId: product._id.toString(),
      timestamp: new Date().toISOString(),
    };

    const qrDataString = JSON.stringify(qrCodeData);
    product.qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      qrDataString
    )}`;
    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error updating product",
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting product",
    });
  }
};

// @desc    Download QR code for product
// @route   GET /api/admin/products/:id/qr-code
// @access  Private/Admin
const downloadQRCode = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.productCode) {
      return res.status(400).json({
        success: false,
        message: "Product code not found",
      });
    }

    // Generate QR code with full product details
    const qrCodeData = {
      productCode: product.productCode,
      name: product.name,
      description: product.description || "",
      price: product.price,
      category: product.category,
      stock: product.stock,
      image: product.image || "",
      keyFeatures: product.keyFeatures || [],
      productId: product._id.toString(),
      timestamp: new Date().toISOString(),
    };

    const qrDataString = JSON.stringify(qrCodeData);
    const qrCodeURL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrDataString)}`;

    // Return the QR code URL so frontend can download it
    res.status(200).json({
      success: true,
      qrCodeURL: qrCodeURL,
      filename: `${product.productCode}_QR.png`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error generating QR code",
    });
  }
};

// @desc    Download barcode for product
// @route   GET /api/admin/products/:id/barcode
// @access  Private/Admin
const downloadBarcode = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.productCode) {
      return res.status(400).json({
        success: false,
        message: "Product code not found",
      });
    }

    // Generate barcode using barcode API (Code128 format)
    // Using barcode.tec-it.com API for barcode generation
    const barcodeURL = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(product.productCode)}&code=Code128&translate-esc=on&dpi=96&imagetype=Png&unit=Fit&dmsize=Default`;

    // Return the barcode URL so frontend can download it
    res.status(200).json({
      success: true,
      barcodeURL: barcodeURL,
      filename: `${product.productCode}_Barcode.png`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error generating barcode",
    });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  downloadQRCode,
  downloadBarcode,
};
