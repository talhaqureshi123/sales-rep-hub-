const Customer = require('../../database/models/Customer');
const User = require('../../database/models/User');
const hubspotService = require('../../services/hubspotService');

// @desc    Get all customers with comprehensive filters
// @route   GET /api/admin/customers
// @access  Private/Admin
// Query params: status, search, city, state, company, orderPotential, monthlySpendMin, monthlySpendMax, createdBy, createdFrom, createdTo, updatedFrom, updatedTo
const getCustomers = async (req, res) => {
  try {
    const { 
      salesman, 
      status, 
      search,
      city,
      state,
      company,
      orderPotential,
      monthlySpendMin,
      monthlySpendMax,
      createdBy,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo
    } = req.query;
    
    const filter = {};

    // Status filter
    if (status && status !== 'All') {
      filter.status = status;
    }

    // City filter
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    // State filter
    if (state) {
      filter.state = { $regex: state, $options: 'i' };
    }

    // Company filter
    if (company) {
      filter.company = { $regex: company, $options: 'i' };
    }

    // Order Potential filter
    if (orderPotential) {
      filter.orderPotential = { $regex: orderPotential, $options: 'i' };
    }

    // Monthly Spend range filter
    if (monthlySpendMin || monthlySpendMax) {
      filter.monthlySpend = {};
      if (monthlySpendMin) {
        filter.monthlySpend.$gte = Number(monthlySpendMin);
      }
      if (monthlySpendMax) {
        filter.monthlySpend.$lte = Number(monthlySpendMax);
      }
    }

    // Created By filter
    if (createdBy) {
      filter.createdBy = createdBy;
    }

    // Date range filters
    if (createdFrom || createdTo) {
      filter.createdAt = {};
      if (createdFrom) {
        filter.createdAt.$gte = new Date(createdFrom);
      }
      if (createdTo) {
        const toDate = new Date(createdTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        filter.createdAt.$lte = toDate;
      }
    }

    if (updatedFrom || updatedTo) {
      filter.updatedAt = {};
      if (updatedFrom) {
        filter.updatedAt.$gte = new Date(updatedFrom);
      }
      if (updatedTo) {
        const toDate = new Date(updatedTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        filter.updatedAt.$lte = toDate;
      }
    }

    // Search filter (searches across multiple fields)
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { pincode: { $regex: search, $options: 'i' } },
        { postcode: { $regex: search, $options: 'i' } },
        { orderPotential: { $regex: search, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
      filters: {
        status: status || 'All',
        city: city || null,
        state: state || null,
        company: company || null,
        orderPotential: orderPotential || null,
        monthlySpendRange: monthlySpendMin || monthlySpendMax ? {
          min: monthlySpendMin || 0,
          max: monthlySpendMax || null
        } : null,
        createdBy: createdBy || null,
        dateRanges: {
          created: createdFrom || createdTo ? {
            from: createdFrom || null,
            to: createdTo || null
          } : null,
          updated: updatedFrom || updatedTo ? {
            from: updatedFrom || null,
            to: updatedTo || null
          } : null
        }
      }
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
      // REMOVED: .populate('assignedSalesman', 'name email customerLimit') - field removed
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

    // REMOVED: Salesman assignment logic - Customers and Salesmen are separate entities
    // Salesmen are assigned to Tasks/FollowUps, not directly to Customers

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
      // REMOVED: assignedSalesman - Customers and Salesmen are separate
      status: status || 'Not Visited',
      notes: notes || undefined,
      competitorInfo: competitorInfo || undefined,
      view: view || 'admin_salesman', // Default: visible to both admin and salesman
      createdBy: req.user._id,
      source: 'app', // Mark app-created customers as 'app' source
    });

    const populatedCustomer = await Customer.findById(customer._id)
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
      // REMOVED: assignedSalesman - Customers and Salesmen are separate
      status,
      notes,
      competitorInfo,
      view,
    } = req.body;

    let customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // REMOVED: Salesman assignment logic - Customers and Salesmen are separate entities

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
    // REMOVED: assignedSalesman assignment - field removed
    if (status) customer.status = status;
    if (notes !== undefined) customer.notes = notes;
    if (competitorInfo !== undefined) customer.competitorInfo = competitorInfo;
    if (view !== undefined) customer.view = view;

    await customer.save();

    const populatedCustomer = await Customer.findById(customer._id)
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

// @desc    Get customer details with all related data (tasks, visits, samples, quotations)
// @route   GET /api/admin/customers/:id/details
// @access  Private/Admin
const getCustomerDetails = async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Get customer
    const customer = await Customer.findById(customerId)
      .populate('createdBy', 'name email role');
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Get all related data in parallel
    const FollowUp = require('../../database/models/FollowUp');
    const VisitTarget = require('../../database/models/VisitTarget');
    const Sample = require('../../database/models/Sample');
    const Quotation = require('../../database/models/Quotation');
    const SalesOrder = require('../../database/models/SalesOrder');

    // Build customer search criteria
    const customerName = customer.name || customer.firstName || '';
    const customerEmail = customer.email || '';
    
    const [tasks, visits, samples, quotations, orders] = await Promise.all([
      // Tasks related to this customer (by customer ObjectId)
      FollowUp.find({ customer: customerId })
        .populate('salesman', 'name email')
        .populate('createdBy', 'name email role')
        .populate('approvedBy', 'name email')
        .sort({ dueDate: -1, createdAt: -1 }),
      
      // Visits related to this customer (by name match - VisitTarget doesn't have customer field)
      // Search by visit name matching customer name
      VisitTarget.find({
        $or: [
          { name: { $regex: customerName, $options: 'i' } },
          { address: customer.address ? { $regex: customer.address, $options: 'i' } : null }
        ].filter(condition => condition !== null && Object.values(condition)[0] !== null)
      })
        .populate('salesman', 'name email')
        .populate('createdBy', 'name email role')
        .sort({ visitDate: -1, createdAt: -1 }),
      
      // Samples related to this customer (by customer ObjectId)
      Sample.find({ customer: customerId })
        .populate('salesman', 'name email')
        .populate('product', 'name')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 }),
      
      // Quotations related to this customer (by customerName or customerEmail)
      // Note: Quotation model doesn't have createdBy field
      Quotation.find({
        $or: [
          customerName ? { customerName: { $regex: customerName, $options: 'i' } } : null,
          customerEmail ? { customerEmail: customerEmail.toLowerCase() } : null
        ].filter(condition => condition !== null)
      })
        .populate('salesman', 'name email')
        .sort({ createdAt: -1 }),
      
      // Orders related to this customer (by email or customer name)
      SalesOrder.find({
        $or: [
          customerEmail ? { emailAddress: customerEmail.toLowerCase() } : null,
          customerName ? { customerName: { $regex: customerName, $options: 'i' } } : null
        ].filter(condition => condition !== null)
      })
        .sort({ orderDate: -1, createdAt: -1 })
        .limit(50), // Limit to recent 50 orders
    ]);

    res.status(200).json({
      success: true,
      data: {
        customer,
        relatedData: {
          tasks: tasks || [],
          visits: visits || [],
          samples: samples || [],
          quotations: quotations || [],
          orders: orders || [],
        },
        counts: {
          tasks: tasks.length,
          visits: visits.length,
          samples: samples.length,
          quotations: quotations.length,
          orders: orders.length,
        }
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching customer details',
    });
  }
};

// @desc    Get customers by salesman (through tasks/visits)
// @route   GET /api/admin/customers/salesman/:salesmanId
// @access  Private/Admin
// NOTE: Customers and Salesmen are separate. This returns customers that have tasks/visits assigned to the salesman.
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

    // Get customers through tasks/visits assigned to this salesman
    const FollowUp = require('../../database/models/FollowUp');
    const VisitTarget = require('../../database/models/VisitTarget');
    
    // Get unique customer IDs from tasks
    const tasks = await FollowUp.find({ salesman: salesmanId }).distinct('customer');
    // Get unique customer IDs from visits
    const visits = await VisitTarget.find({ salesman: salesmanId }).distinct('customer');
    
    // Combine and get unique customer IDs
    const customerIds = [...new Set([...tasks, ...visits].filter(id => id))];
    
    const customers = await Customer.find({ _id: { $in: customerIds } })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        salesman: {
          id: salesman._id,
          name: salesman.name,
          email: salesman.email,
        },
        customers,
        count: customers.length,
        note: 'Customers shown are those with tasks/visits assigned to this salesman',
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
  getCustomerDetails,
};


