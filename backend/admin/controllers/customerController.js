const Customer = require('../../database/models/Customer');
const User = require('../../database/models/User');
const hubspotService = require('../../services/hubspotService');

// @desc    Get all customers
// @route   GET /api/admin/customers
// @access  Private/Admin
const getCustomers = async (req, res) => {
  try {
    const { salesman, status, search } = req.query;
    const filter = {};

    if (salesman) {
      filter.assignedSalesman = salesman;
    }
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(filter)
      .populate('assignedSalesman', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

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
// @route   GET /api/admin/customers/:id
// @access  Private/Admin
const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('assignedSalesman', 'name email customerLimit')
      .populate('createdBy', 'name email');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
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

// @desc    Create customer
// @route   POST /api/admin/customers
// @access  Private/Admin
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
      assignedSalesman,
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

    // If salesman is assigned, check customer limit
    if (assignedSalesman) {
      const salesman = await User.findById(assignedSalesman);
      if (!salesman || salesman.role !== 'salesman') {
        return res.status(400).json({
          success: false,
          message: 'Invalid salesman selected',
        });
      }

      // Check if salesman has customer limit
      if (salesman.customerLimit !== null && salesman.customerLimit !== undefined) {
        const assignedCustomersCount = await Customer.countDocuments({
          assignedSalesman: assignedSalesman,
          status: 'Active',
        });

        if (assignedCustomersCount >= salesman.customerLimit) {
          return res.status(400).json({
            success: false,
            message: `Salesman has reached customer limit (${salesman.customerLimit}). Cannot assign more customers.`,
          });
        }
      }
    }

    const customer = await Customer.create({
      firstName: firstName || customerName,
      name: customerName, // Keep name for backward compatibility
      contactPerson: contactPerson || undefined,
      email: email || undefined,
      phone: phone || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      pincode: pincode || postcode || undefined,
      postcode: postcode || pincode || undefined,
      company: company || undefined,
      orderPotential: orderPotential || undefined,
      monthlySpend: monthlySpend || 0,
      assignedSalesman: assignedSalesman || null,
      status: status || 'Not Visited',
      notes: notes || undefined,
      competitorInfo: competitorInfo || undefined,
      createdBy: req.user._id,
    });

    const populatedCustomer = await Customer.findById(customer._id)
      .populate('assignedSalesman', 'name email customerLimit')
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

// @desc    Update customer
// @route   PUT /api/admin/customers/:id
// @access  Private/Admin
const updateCustomer = async (req, res) => {
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
      assignedSalesman,
      status,
      notes,
      competitorInfo,
    } = req.body;

    let customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // If salesman is being assigned or changed, check customer limit
    if (assignedSalesman && assignedSalesman !== customer.assignedSalesman?.toString()) {
      const salesman = await User.findById(assignedSalesman);
      if (!salesman || salesman.role !== 'salesman') {
        return res.status(400).json({
          success: false,
          message: 'Invalid salesman selected',
        });
      }

      // Check if salesman has customer limit
      if (salesman.customerLimit !== null && salesman.customerLimit !== undefined) {
        const assignedCustomersCount = await Customer.countDocuments({
          assignedSalesman: assignedSalesman,
          status: 'Active',
          _id: { $ne: customer._id }, // Exclude current customer
        });

        if (assignedCustomersCount >= salesman.customerLimit) {
          return res.status(400).json({
            success: false,
            message: `Salesman has reached customer limit (${salesman.customerLimit}). Cannot assign more customers.`,
          });
        }
      }
    }

    // Update fields
    const customerName = firstName || name;
    if (customerName) {
      customer.firstName = firstName || customerName;
      customer.name = customerName; // Keep name for backward compatibility
    }
    if (contactPerson !== undefined) customer.contactPerson = contactPerson;
    if (email !== undefined) customer.email = email;
    if (phone !== undefined) customer.phone = phone;
    if (address !== undefined) customer.address = address;
    if (city !== undefined) customer.city = city;
    if (state !== undefined) customer.state = state;
    if (pincode !== undefined) customer.pincode = pincode;
    if (postcode !== undefined) customer.postcode = postcode;
    if (company !== undefined) customer.company = company;
    if (orderPotential !== undefined) customer.orderPotential = orderPotential;
    if (monthlySpend !== undefined) customer.monthlySpend = monthlySpend;
    if (assignedSalesman !== undefined) {
      customer.assignedSalesman = assignedSalesman || null;
    }
    if (status) customer.status = status;
    if (notes !== undefined) customer.notes = notes;
    if (competitorInfo !== undefined) customer.competitorInfo = competitorInfo;

    await customer.save();

    const populatedCustomer = await Customer.findById(customer._id)
      .populate('assignedSalesman', 'name email customerLimit')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: populatedCustomer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating customer',
    });
  }
};

// @desc    Delete customer
// @route   DELETE /api/admin/customers/:id
// @access  Private/Admin
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    await customer.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting customer',
    });
  }
};

// @desc    Get customers by salesman with limit info
// @route   GET /api/admin/customers/salesman/:salesmanId
// @access  Private/Admin
const getCustomersBySalesman = async (req, res) => {
  try {
    const { salesmanId } = req.params;
    
    const salesman = await User.findById(salesmanId);
    if (!salesman || salesman.role !== 'salesman') {
      return res.status(404).json({
        success: false,
        message: 'Salesman not found',
      });
    }

    const customers = await Customer.find({ assignedSalesman: salesmanId })
      .populate('assignedSalesman', 'name email customerLimit')
      .sort({ createdAt: -1 });

    const assignedCount = customers.filter(c => c.status === 'Active').length;

    res.status(200).json({
      success: true,
      data: {
        salesman: {
          id: salesman._id,
          name: salesman.name,
          email: salesman.email,
          customerLimit: salesman.customerLimit,
          assignedCustomers: assignedCount,
          remainingSlots: salesman.customerLimit !== null 
            ? Math.max(0, salesman.customerLimit - assignedCount)
            : null,
        },
        customers,
        count: customers.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching customers',
    });
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomersBySalesman,
};


