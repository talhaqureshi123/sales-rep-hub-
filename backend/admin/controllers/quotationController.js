const Quotation = require('../../database/models/Quotation');
const User = require('../../database/models/User');

// @desc    Get all quotations (admin view)
// @route   GET /api/admin/quotations
// @access  Private/Admin
const getQuotations = async (req, res) => {
  try {
    const { salesman, status, search, startDate, endDate } = req.query;
    const filter = {};

    if (salesman) {
      filter.salesman = salesman;
    }
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { quotationNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    const quotations = await Quotation.find(filter)
      .populate('salesman', 'name email')
      .populate('items.product', 'name productCode price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching quotations',
    });
  }
};

// @desc    Get single quotation
// @route   GET /api/admin/quotations/:id
// @access  Private/Admin
const getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('salesman', 'name email phone')
      .populate('items.product', 'name productCode price description');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching quotation',
    });
  }
};

// @desc    Create quotation (admin)
// @route   POST /api/admin/quotations
// @access  Private/Admin
const createQuotation = async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, customerAddress, validUntil, items, tax, discount, notes, status, salesman } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one item',
      });
    }

    // Validate and process items
    const Product = require('../../database/models/Product');
    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      if (!item.productId) {
        continue; // Skip items without product
      }
      
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found or inactive`,
        });
      }

      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice || product.price;
      const itemDiscount = item.discount || 0;
      const itemSubtotal = quantity * unitPrice;
      const discountAmount = (itemSubtotal * itemDiscount) / 100;
      const itemTotal = itemSubtotal - discountAmount;
      
      subtotal += itemTotal;

      processedItems.push({
        product: product._id,
        productCode: product.productCode,
        productName: item.productName || product.name,
        quantity: quantity,
        price: unitPrice,
        discount: itemDiscount,
        total: itemTotal,
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one valid item',
      });
    }

    // Calculate totals
    const taxAmount = tax || (subtotal * 0.20); // Default 20% tax
    const discountAmount = discount || 0;
    const total = subtotal + taxAmount - discountAmount;

    // Generate quotation number
    const count = await Quotation.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const number = String(count + 1).padStart(4, '0');
    const quotationNumber = `QT-${year}${month}-${number}`;

    // Get salesman ID - use provided salesman or current user
    let salesmanId = salesman;
    if (!salesmanId) {
      // If no salesman provided, try to find one or use current user
      salesmanId = req.user._id;
    }

    const quotation = await Quotation.create({
      quotationNumber,
      salesman: salesmanId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      validUntil: validUntil ? new Date(validUntil) : null,
      items: processedItems,
      subtotal,
      tax: taxAmount,
      discount: discountAmount,
      total,
      notes,
      status: status || 'Draft',
    });

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('salesman', 'name email')
      .populate('items.product', 'name productCode price');

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: populatedQuotation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating quotation',
    });
  }
};

// @desc    Update quotation status
// @route   PUT /api/admin/quotations/:id
// @access  Private/Admin
const updateQuotation = async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, customerAddress, validUntil, items, tax, discount, notes, status } = req.body;

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    // Update customer details
    if (customerName) quotation.customerName = customerName;
    if (customerEmail !== undefined) quotation.customerEmail = customerEmail;
    if (customerPhone !== undefined) quotation.customerPhone = customerPhone;
    if (customerAddress !== undefined) quotation.customerAddress = customerAddress;
    if (validUntil) quotation.validUntil = new Date(validUntil);
    if (notes !== undefined) quotation.notes = notes;
    if (status) quotation.status = status;

    // Update items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const Product = require('../../database/models/Product');
      const processedItems = [];
      let subtotal = 0;

      for (const item of items) {
        if (!item.productId) {
          continue;
        }
        
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          continue; // Skip invalid products
        }

        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || product.price;
        const itemDiscount = item.discount || 0;
        const itemSubtotal = quantity * unitPrice;
        const discountAmount = (itemSubtotal * itemDiscount) / 100;
        const itemTotal = itemSubtotal - discountAmount;
        
        subtotal += itemTotal;

        processedItems.push({
          product: product._id,
          productCode: product.productCode,
          productName: item.productName || product.name,
          quantity: quantity,
          price: unitPrice,
          discount: itemDiscount,
          total: itemTotal,
        });
      }

      if (processedItems.length > 0) {
        quotation.items = processedItems;
        quotation.subtotal = subtotal;
        quotation.tax = tax !== undefined ? tax : (subtotal * 0.20);
        quotation.discount = discount || 0;
        quotation.total = quotation.subtotal + quotation.tax - quotation.discount;
      }
    } else if (tax !== undefined || discount !== undefined) {
      // Update totals if items not changed
      if (tax !== undefined) quotation.tax = tax;
      if (discount !== undefined) quotation.discount = discount;
      quotation.total = quotation.subtotal + quotation.tax - quotation.discount;
    }

    await quotation.save();

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('salesman', 'name email')
      .populate('items.product', 'name productCode price');

    res.status(200).json({
      success: true,
      message: 'Quotation updated successfully',
      data: populatedQuotation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating quotation',
    });
  }
};

// @desc    Delete quotation
// @route   DELETE /api/admin/quotations/:id
// @access  Private/Admin
const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    await Quotation.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Quotation deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting quotation',
    });
  }
};

// @desc    Get quotations statistics
// @route   GET /api/admin/quotations/stats
// @access  Private/Admin
const getQuotationStats = async (req, res) => {
  try {
    const totalQuotations = await Quotation.countDocuments();
    const draftQuotations = await Quotation.countDocuments({ status: 'Draft' });
    const sentQuotations = await Quotation.countDocuments({ status: 'Sent' });
    const approvedQuotations = await Quotation.countDocuments({ status: 'Approved' });
    const rejectedQuotations = await Quotation.countDocuments({ status: 'Rejected' });

    const totalAmount = await Quotation.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalQuotations,
        draft: draftQuotations,
        sent: sentQuotations,
        approved: approvedQuotations,
        rejected: rejectedQuotations,
        totalAmount: totalAmount[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching quotation statistics',
    });
  }
};

module.exports = {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  getQuotationStats,
};
