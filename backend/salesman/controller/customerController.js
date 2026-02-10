const Customer = require('../../database/models/Customer');
const User = require('../../database/models/User');
const hubspotService = require('../../services/hubspotService');

// @desc    Get customers for logged-in salesman (through tasks/visits or created by salesman) with filters
// @route   GET /api/salesman/customers
// @access  Private/Salesman
// NOTE: Customers and Salesmen are separate. Shows customers with tasks/visits assigned to this salesman.
// Query params: status, search, city, state, company, orderPotential, monthlySpendMin, monthlySpendMax
const getMyCustomers = async (req, res) => {
  try {
    const { 
      status, 
      search,
      city,
      state,
      company,
      orderPotential,
      monthlySpendMin,
      monthlySpendMax
    } = req.query;
    
    // Get customers: created by this salesman OR through tasks/visits/allotment
    const FollowUp = require('../../database/models/FollowUp');
    const VisitTarget = require('../../database/models/VisitTarget');
    
    const taskCustomerIds = await FollowUp.find({ salesman: req.user._id }).distinct('customer');
    const visitCustomerIds = await VisitTarget.find({ salesman: req.user._id }).distinct('customerId');
    const allottedCustomerIds = await Customer.find({ allottedSalesman: req.user._id }).distinct('_id');
    const createdByMeIds = await Customer.find({ createdBy: req.user._id }).distinct('_id');

    const relatedCustomerIds = [...new Set([...taskCustomerIds, ...visitCustomerIds, ...allottedCustomerIds, ...createdByMeIds].filter(id => id))];

    const filter = { _id: { $in: relatedCustomerIds } };

    // Apply additional filters
    if (status && status !== 'All') {
      filter.status = status;
    }

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (state) {
      filter.state = { $regex: state, $options: 'i' };
    }

    if (company) {
      filter.company = { $regex: company, $options: 'i' };
    }

    if (orderPotential) {
      filter.orderPotential = { $regex: orderPotential, $options: 'i' };
    }

    if (monthlySpendMin || monthlySpendMax) {
      filter.monthlySpend = {};
      if (monthlySpendMin) {
        filter.monthlySpend.$gte = Number(monthlySpendMin);
      }
      if (monthlySpendMax) {
        filter.monthlySpend.$lte = Number(monthlySpendMax);
      }
    }

    if (status) {
      filter.status = status;
    }
    if (search) {
      const searchFilter = {
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { company: { $regex: search, $options: 'i' } },
          { contactPerson: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } },
          { state: { $regex: search, $options: 'i' } },
        ],
      };
      filter.$and = [{ _id: { $in: relatedCustomerIds } }, searchFilter];
      delete filter._id;
    }

    const customers = await Customer.find(filter)
      .populate('createdBy', 'name email')
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
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const FollowUp = require('../../database/models/FollowUp');
    const VisitTarget = require('../../database/models/VisitTarget');
    const createdByMe = (customer.createdBy?._id || customer.createdBy)?.toString() === req.user._id.toString();
    const allottedId = customer.allottedSalesman?._id || customer.allottedSalesman;
    const allottedToMe = allottedId && allottedId.toString() === req.user._id.toString();
    const hasTasks = await FollowUp.findOne({ customer: customer._id, salesman: req.user._id });
    const hasVisits = await VisitTarget.findOne({ customerId: customer._id, salesman: req.user._id });

    if (!createdByMe && !allottedToMe && !hasTasks && !hasVisits) {
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
      associatedContactName,
      associatedCompanyName,
      lastContact,
      lastEngagement,
      view,
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

    // Create customer – createdBy salesman; approvalStatus Pending until admin approves
    const customer = await Customer.create({
      firstName: customerName,
      name: customerName,
      contactPerson,
      email,
      phone,
      address,
      city,
      state,
      pincode: postcode || pincode,
      postcode: postcode || pincode,
      company,
      orderPotential,
      monthlySpend: monthlySpend || 0,
      status: status || 'Active',
      notes,
      competitorInfo,
      associatedContactName: associatedContactName || undefined,
      associatedCompanyName: associatedCompanyName || undefined,
      lastContact: lastContact ? new Date(lastContact) : undefined,
      lastEngagement: lastEngagement ? new Date(lastEngagement) : undefined,
      view: view || 'admin_salesman',
      createdBy: req.user._id,
      approvalStatus: 'Pending',
    });

    const populatedCustomer = await Customer.findById(customer._id)
      // REMOVED: .populate('assignedSalesman', 'name email') - field removed
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


