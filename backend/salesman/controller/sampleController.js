const Sample = require('../../database/models/Sample');
const Customer = require('../../database/models/Customer');
const Product = require('../../database/models/Product');
const VisitTarget = require('../../database/models/VisitTarget');
const FollowUp = require('../../database/models/FollowUp');

// @desc    Get all samples for logged-in salesman
// @route   GET /api/salesman/samples
// @access  Private/Salesman
const getSamples = async (req, res) => {
  try {
    const { status, search, startDate, endDate } = req.query;
    
    // Build base filter - only show approved samples to salesman
    const baseFilter = {
      salesman: req.user._id,
      $or: [
        { approvalStatus: 'Approved' },
        { approvalStatus: { $exists: false } } // Backward compatibility: show samples without approvalStatus
      ]
    };

    if (status && status !== 'All') {
      baseFilter.status = status;
    }
    
    if (startDate || endDate) {
      baseFilter.visitDate = {};
      if (startDate) {
        baseFilter.visitDate.$gte = new Date(startDate);
      }
      if (endDate) {
        baseFilter.visitDate.$lte = new Date(endDate);
      }
    }

    // If search is provided, use $and to combine base filter with search
    let filter = baseFilter;
    if (search) {
      filter = {
        $and: [
          baseFilter,
          {
            $or: [
              { sampleNumber: { $regex: search, $options: 'i' } },
              { customerName: { $regex: search, $options: 'i' } },
              { productName: { $regex: search, $options: 'i' } },
              { productCode: { $regex: search, $options: 'i' } },
            ]
          }
        ]
      };
    }

    const samples = await Sample.find(filter)
      .populate('customer', 'name email phone')
      .populate('product', 'name productCode price')
      .populate('visitTarget', 'name address')
      .sort({ createdAt: -1 })
      .lean();

    const seenIds = new Set();
    const unique = samples.filter((s) => {
      const id = (s._id && s._id.toString()) || (s.id && s.id.toString());
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    res.status(200).json({
      success: true,
      count: unique.length,
      data: unique,
    });
  } catch (error) {
    console.error("getSamples error:", error);
    res.status(500).json({
      success: false,
      message: (error && error.message) ? String(error.message) : "Error fetching samples",
    });
  }
};

// @desc    Get single sample
// @route   GET /api/salesman/samples/:id
// @access  Private/Salesman
const getSample = async (req, res) => {
  try {
    const sample = await Sample.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    })
      .populate('customer', 'name email phone address')
      .populate('product', 'name productCode price description')
      .populate('visitTarget', 'name address city');

    if (!sample) {
      return res.status(404).json({
        success: false,
        message: 'Sample not found',
      });
    }

    res.status(200).json({
      success: true,
      data: sample,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sample',
    });
  }
};

// @desc    Create sample
// @route   POST /api/salesman/samples
// @access  Private/Salesman
const createSample = async (req, res) => {
  try {
    const {
      customer,
      customerName,
      customerEmail,
      customerPhone,
      product,
      productName,
      productCode,
      quantity,
      visitTarget,
      visitDate,
      expectedDate,
      notes,
    } = req.body;

    // Validate required fields
    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide customer name',
      });
    }

    if (!productName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide product name',
      });
    }

    // Verify customer exists and is related to this salesman (via task, visit, or Customer Allotment) if provided
    if (customer) {
      const customerDoc = await Customer.findById(customer);
      if (!customerDoc) {
        return res.status(400).json({
          success: false,
          message: 'Customer not found',
        });
      }
      const allottedId = customerDoc.allottedSalesman?._id || customerDoc.allottedSalesman;
      const allottedToMe = allottedId && allottedId.toString() === req.user._id.toString();
      const hasTaskOrVisit = await FollowUp.findOne({ salesman: req.user._id, customer: customer }) ||
        await VisitTarget.findOne({ salesman: req.user._id, customerId: customer });
      if (!allottedToMe && !hasTaskOrVisit) {
        return res.status(400).json({
          success: false,
          message: 'Customer not assigned to you (no task or visit with this customer)',
        });
      }
    }

    // Verify product exists if provided
    if (product) {
      const productDoc = await Product.findById(product);
      if (!productDoc || !productDoc.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Product not found or inactive',
        });
      }
    }

    // Verify visit target exists and belongs to salesman if provided
    if (visitTarget) {
      const visitTargetDoc = await VisitTarget.findOne({
        _id: visitTarget,
        salesman: req.user._id,
      });
      if (!visitTargetDoc) {
        return res.status(400).json({
          success: false,
          message: 'Visit target not found or not assigned to you',
        });
      }
    }

    // Create sample (sampleNumber will be auto-generated by pre-save hook)
    // Salesman-created samples need admin approval
    const sample = await Sample.create({
      salesman: req.user._id,
      customer: customer || undefined,
      customerName,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      product: product || undefined,
      productName,
      productCode: productCode || undefined,
      quantity: quantity || 1,
      visitTarget: visitTarget || undefined,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      expectedDate: expectedDate ? new Date(expectedDate) : undefined,
      notes: notes || undefined,
      status: 'Pending',
      approvalStatus: 'Pending', // Salesman-created samples need admin approval
      createdBy: req.user._id,
    });

    const populatedSample = await Sample.findById(sample._id)
      .populate('customer', 'name email phone')
      .populate('product', 'name productCode price')
      .populate('visitTarget', 'name address');

    res.status(201).json({
      success: true,
      message: 'Sample created successfully',
      data: populatedSample,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Sample number already exists',
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating sample',
    });
  }
};

// @desc    Update sample
// @route   PUT /api/salesman/samples/:id
// @access  Private/Salesman
const updateSample = async (req, res) => {
  try {
    const { customerFeedback, notes } = req.body;

    const sample = await Sample.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!sample) {
      return res.status(404).json({
        success: false,
        message: 'Sample not found',
      });
    }

    // Salesman can only update feedback and notes, not status
    if (customerFeedback !== undefined) {
      sample.customerFeedback = customerFeedback;
    }
    if (notes !== undefined) {
      sample.notes = notes;
    }

    await sample.save();

    const populatedSample = await Sample.findById(sample._id)
      .populate('customer', 'name email phone')
      .populate('product', 'name productCode price')
      .populate('visitTarget', 'name address');

    res.status(200).json({
      success: true,
      message: 'Sample updated successfully',
      data: populatedSample,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating sample',
    });
  }
};

module.exports = {
  getSamples,
  getSample,
  createSample,
  updateSample,
};
