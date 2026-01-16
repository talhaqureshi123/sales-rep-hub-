const Customer = require('../../database/models/Customer');
const User = require('../../database/models/User');
const hubspotService = require('../../services/hubspotService');

// @desc    Get customers assigned to logged-in salesman or created by salesman
// @route   GET /api/salesman/customers
// @access  Private/Salesman
const getMyCustomers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {
      $or: [
        { assignedSalesman: req.user._id },
        { createdBy: req.user._id }, // Also show customers created by this salesman
      ],
    };

    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(filter)
      .populate('assignedSalesman', 'name email')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching customers',
    });
  }
};

// @desc    Get single customer
// @route   GET /api/salesman/customers/:id
// @access  Private/Salesman
const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      assignedSalesman: req.user._id,
    }).populate('assignedSalesman', 'name email');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found or not assigned to you',
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching customer',
    });
  }
};

// @desc    Create customer (salesman creates their own customer)
// @route   POST /api/salesman/customers
// @access  Private/Salesman
const createCustomer = async (req, res) => {
  try {
    const {
      firstName,
      name,
      contactPerson,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      postcode,
      company,
      orderPotential,
      monthlySpend,
      status,
      notes,
      competitorInfo,
    } = req.body;

    // Validate required fields - use firstName if provided, otherwise use name
    const customerName = firstName || name;
    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide customer first name',
      });
    }

    // Check if salesman has customer limit
    const salesman = await User.findById(req.user._id);
    if (salesman && salesman.customerLimit !== null && salesman.customerLimit !== undefined) {
      const assignedCustomersCount = await Customer.countDocuments({
        assignedSalesman: req.user._id,
        status: 'Active',
      });

      if (assignedCustomersCount >= salesman.customerLimit) {
        return res.status(400).json({
          success: false,
          message: `You have reached your customer limit (${salesman.customerLimit}). Cannot create more customers.`,
        });
      }
    }

    // Create customer - automatically assign to logged-in salesman and set createdBy
    const customer = await Customer.create({
      firstName: customerName,
      name: customerName, // Keep name for backward compatibility
      contactPerson,
      email,
      phone,
      address,
      city,
      state,
      pincode: postcode || pincode, // Use postcode if provided, otherwise pincode
      postcode: postcode || pincode,
      company,
      orderPotential,
      monthlySpend: monthlySpend || 0,
      assignedSalesman: req.user._id, // Auto-assign to logged-in salesman
      status: status || 'Active',
      notes,
      competitorInfo,
      createdBy: req.user._id, // Set createdBy to logged-in salesman
    });

    const populatedCustomer = await Customer.findById(customer._id)
      .populate('assignedSalesman', 'name email')
      .populate('createdBy', 'name email');

    // Sync to HubSpot (async, non-blocking)
    hubspotService.createOrUpdateContact({
      name: populatedCustomer.firstName || populatedCustomer.name,
      email: populatedCustomer.email,
      phone: populatedCustomer.phone,
      address: populatedCustomer.address,
      city: populatedCustomer.city,
      state: populatedCustomer.state,
      pincode: populatedCustomer.postcode || populatedCustomer.pincode,
      company: populatedCustomer.company,
      status: populatedCustomer.status,
      notes: populatedCustomer.notes,
      contactPerson: populatedCustomer.contactPerson,
      orderPotential: populatedCustomer.orderPotential,
      monthlySpend: populatedCustomer.monthlySpend,
      competitorInfo: populatedCustomer.competitorInfo,
    }).catch(error => {
      console.error('HubSpot sync error (non-blocking):', error.message);
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: populatedCustomer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating customer',
    });
  }
};

module.exports = {
  getMyCustomers,
  getCustomer,
  createCustomer,
};


