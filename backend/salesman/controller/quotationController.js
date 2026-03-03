const Quotation = require('../../database/models/Quotation');
const Product = require('../../database/models/Product');
const hubspotService = require('../../services/hubspotService');
const FollowUp = require('../../database/models/FollowUp');
const VisitTarget = require('../../database/models/VisitTarget');
const Customer = require('../../database/models/Customer');
const { sendQuotationEmail } = require('../../utils/emailService');

// Helper: next quotation number = max in this month + 1 + offset (offset used on retry to avoid same number)
const generateQuotationNumber = async (offset = 0) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `QT-${year}${month}-`;
  const last = await Quotation.findOne({ quotationNumber: new RegExp(`^${prefix}`) })
    .sort({ quotationNumber: -1 })
    .select('quotationNumber')
    .lean();
  const nextSeq = last
    ? parseInt(last.quotationNumber.split('-')[2], 10) + 1 + offset
    : 1 + offset;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

// Get customer names and emails that belong to this salesman (from tasks + visits)
const getMyCustomerNamesAndEmails = async (salesmanId) => {
  const names = new Set();
  const emails = new Set();
  const customerIds = new Set();

  const tasks = await FollowUp.find({ salesman: salesmanId }).select('customerName customerEmail customer').lean();
  tasks.forEach((t) => {
    if (t.customerName && t.customerName.trim()) names.add(t.customerName.trim());
    if (t.customerEmail && t.customerEmail.trim()) emails.add(t.customerEmail.trim().toLowerCase());
    if (t.customer) customerIds.add(t.customer.toString());
  });

  const visits = await VisitTarget.find({ salesman: salesmanId }).select('customerName customerId').lean();
  visits.forEach((v) => {
    if (v.customerName && v.customerName.trim()) names.add(v.customerName.trim());
    if (v.customerId) customerIds.add(v.customerId.toString());
  });

  if (customerIds.size > 0) {
    const customers = await Customer.find({ _id: { $in: Array.from(customerIds) } }).select('name firstName email').lean();
    customers.forEach((c) => {
      const n = (c.name || c.firstName || '').trim();
      if (n) names.add(n);
      if (c.email && c.email.trim()) emails.add(c.email.trim().toLowerCase());
    });
  }

  return { names: Array.from(names), emails: Array.from(emails) };
};

// @desc    Get all quotations for salesman (only own – admin quotations are hidden)
// @route   GET /api/salesman/quotations
// @access  Private/Salesman
const getQuotations = async (req, res) => {
  try {
    const { status } = req.query;
    const salesmanId = req.user._id;

    const filter = { salesman: salesmanId, $nor: [{ createdBy: 'admin' }] };

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

// @desc    Get single quotation (only own – admin quotations are hidden)
// @route   GET /api/salesman/quotations/:id
// @access  Private/Salesman
const getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      salesman: req.user._id,
      createdBy: { $ne: 'admin' },
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
    const { customerName, customerEmail, customerPhone, customerAddress, validUntil, items, tax, discount, notes } = req.body;

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

    // Generate quotation number; on duplicate key retry with next number (offset = attempt)
    let quotation;
    for (let attempt = 0; attempt < 5; attempt++) {
      const quotationNumber = await generateQuotationNumber(attempt);
      try {
        quotation = await Quotation.create({
          quotationNumber,
      salesman: req.user._id,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      items: processedItems,
      subtotal,
      tax: taxAmount,
      discount: discountAmount,
      total,
      notes,
      status: 'Draft',
      createdBy: 'salesman',
        });
        break;
      } catch (err) {
        const isDuplicate = err.code === 11000 || (err.code === 11001) || (err.message && err.message.includes('duplicate key'));
        if (isDuplicate && attempt < 4) {
          continue; // next attempt will use generateQuotationNumber(attempt+1) = max+2, max+3, etc.
        }
        throw err;
      }
    }

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
            quotationNumber: quotation.quotationNumber,
            total: total,
            status: 'Draft',
            notes: notes,
            items: processedItems,
          }, contactId);

          // Add note about quotation
          await hubspotService.createNote(
            contactId,
            `Quotation ${quotation.quotationNumber} created. Amount: ${total}. Items: ${processedItems.length}`,
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

    const { customerName, customerEmail, customerPhone, customerAddress, validUntil, items, tax, discount, notes, status } = req.body;

    // Update customer info
    if (customerName) quotation.customerName = customerName;
    if (customerEmail !== undefined) quotation.customerEmail = customerEmail;
    if (customerPhone !== undefined) quotation.customerPhone = customerPhone;
    if (customerAddress !== undefined) quotation.customerAddress = customerAddress;
    if (validUntil !== undefined) quotation.validUntil = validUntil ? new Date(validUntil) : null;
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

    // Salesman can delete their own quotations (any status), same as admin for their quotes
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

// @desc    Send quotation by email to customer (link/details to customer email)
// @route   POST /api/salesman/quotations/:id/send-email
// @access  Private/Salesman
const sendQuotationByEmail = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    }).populate('salesman', 'name email');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    const toEmail = (quotation.customerEmail || '').trim();
    if (!toEmail) {
      return res.status(400).json({
        success: false,
        message: 'Customer email is missing. Add customer email to send quotation.',
      });
    }

    const items = (quotation.items || []).map((item) => ({
      productName: item.productName || item.productCode || '-',
      productCode: item.productCode,
      quantity: item.quantity || 0,
      price: item.price || 0,
      total: item.total || 0,
    }));

    const fromEmail = (req.user && req.user.email) ? req.user.email : null;
    const fromName = (req.user && req.user.name) ? req.user.name : 'Sales Rep';
    const result = await sendQuotationEmail(toEmail, {
      quotationNumber: quotation.quotationNumber || '',
      customerName: quotation.customerName || '',
      billingAddress: quotation.customerAddress || '',
      deliveryAddress: quotation.customerAddress || '',
      subtotal: quotation.subtotal ?? quotation.total ?? 0,
      tax: quotation.tax ?? 0,
      total: quotation.total || 0,
      validUntil: quotation.validUntil || '',
      items,
      notes: quotation.notes || '',
    }, fromEmail, fromName);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || result.error || 'Failed to send email',
      });
    }

    quotation.status = 'Sent';
    await quotation.save();

    res.status(200).json({
      success: true,
      message: 'Quotation sent to customer email successfully',
      data: { messageId: result.messageId },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error sending quotation email',
    });
  }
};

module.exports = {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  sendQuotationByEmail,
};


