const Quotation = require('../../database/models/Quotation');
const Product = require('../../database/models/Product');
const hubspotService = require('../../services/hubspotService');

// Helper function to generate quotation number
const generateQuotationNumber = async () => {
  const count = await Quotation.countDocuments();
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const number = String(count + 1).padStart(4, '0');
  return `QT-${year}${month}-${number}`;
};

// @desc    Get all quotations for salesman
// @route   GET /api/salesman/quotations
// @access  Private/Salesman
const getQuotations = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { salesman: req.user._id };

    if (status) {
      filter.status = status;
    }

    const quotations = await Quotation.find(filter)
      .populate('salesman', 'name email')
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
// @route   GET /api/salesman/quotations/:id
// @access  Private/Salesman
const getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    }).populate('salesman', 'name email').populate('items.product', 'name productCode price');

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

// @desc    Create quotation
// @route   POST /api/salesman/quotations
// @access  Private/Salesman
const createQuotation = async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, customerAddress, items, tax, discount, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one item',
      });
    }

    // Validate and process items
    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found or inactive`,
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      processedItems.push({
        product: product._id,
        productCode: product.productCode,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
      });
    }

    // Calculate totals
    const taxAmount = tax || 0;
    const discountAmount = discount || 0;
    const total = subtotal + taxAmount - discountAmount;

    // Generate quotation number
    const quotationNumber = await generateQuotationNumber();

    const quotation = await Quotation.create({
      quotationNumber,
      salesman: req.user._id,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      items: processedItems,
      subtotal,
      tax: taxAmount,
      discount: discountAmount,
      total,
      notes,
      status: 'Draft',
    });

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('salesman', 'name email')
      .populate('items.product', 'name productCode price');

    // Sync to HubSpot (async, non-blocking)
    (async () => {
      try {
        // Find or create contact in HubSpot
        let contactId = null;
        if (customerEmail) {
          contactId = await hubspotService.findContactByEmail(customerEmail);
          if (!contactId) {
            // Create contact if not found
            const contact = await hubspotService.createOrUpdateContact({
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
              address: customerAddress,
            });
            contactId = contact?.id;
          }
        }

        // Create deal in HubSpot
        if (contactId) {
          await hubspotService.createDeal({
            quotationNumber: quotationNumber,
            total: total,
            status: 'Draft',
            notes: notes,
            items: processedItems,
          }, contactId);

          // Add note about quotation
          await hubspotService.createNote(
            contactId,
            `Quotation ${quotationNumber} created. Amount: ${total}. Items: ${processedItems.length}`,
            'QUOTATION_CREATED'
          );
        }
      } catch (error) {
        console.error('HubSpot sync error (non-blocking):', error.message);
      }
    })();

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

// @desc    Update quotation
// @route   PUT /api/salesman/quotations/:id
// @access  Private/Salesman
const updateQuotation = async (req, res) => {
  try {
    let quotation = await Quotation.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    // Only allow updates to Draft quotations
    if (quotation.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft quotations can be updated',
      });
    }

    const { customerName, customerEmail, customerPhone, customerAddress, items, tax, discount, notes, status } = req.body;

    // Update customer info
    if (customerName) quotation.customerName = customerName;
    if (customerEmail !== undefined) quotation.customerEmail = customerEmail;
    if (customerPhone !== undefined) quotation.customerPhone = customerPhone;
    if (customerAddress !== undefined) quotation.customerAddress = customerAddress;
    if (notes !== undefined) quotation.notes = notes;
    if (status) quotation.status = status;

    // Update items if provided
    if (items && items.length > 0) {
      const processedItems = [];
      let subtotal = 0;

      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          return res.status(400).json({
            success: false,
            message: `Product ${item.productId} not found or inactive`,
          });
        }

        const itemTotal = product.price * item.quantity;
        subtotal += itemTotal;

        processedItems.push({
          product: product._id,
          productCode: product.productCode,
          productName: product.name,
          quantity: item.quantity,
          price: product.price,
          total: itemTotal,
        });
      }

      quotation.items = processedItems;
      quotation.subtotal = subtotal;

      // Recalculate totals
      const taxAmount = tax !== undefined ? tax : quotation.tax;
      const discountAmount = discount !== undefined ? discount : quotation.discount;
      quotation.tax = taxAmount;
      quotation.discount = discountAmount;
      quotation.total = subtotal + taxAmount - discountAmount;
    } else if (tax !== undefined || discount !== undefined) {
      // Update tax/discount without changing items
      const taxAmount = tax !== undefined ? tax : quotation.tax;
      const discountAmount = discount !== undefined ? discount : quotation.discount;
      quotation.tax = taxAmount;
      quotation.discount = discountAmount;
      quotation.total = quotation.subtotal + taxAmount - discountAmount;
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
// @route   DELETE /api/salesman/quotations/:id
// @access  Private/Salesman
const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    // Only allow deletion of Draft quotations
    if (quotation.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft quotations can be deleted',
      });
    }

    await quotation.deleteOne();

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

module.exports = {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
};


