const SalesOrder = require("../../database/models/SalesOrder");
const hubspotService = require("../../services/hubspotService");

// @desc    Get all sales orders
// @route   GET /api/admin/sales-orders
// @access  Private/Admin
const getSalesOrders = async (req, res) => {
  try {
    const { status, search, salesPerson } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.orderStatus = status;
    }
    if (salesPerson) {
      filter.salesPerson = salesPerson;
    }
    if (search) {
      filter.$or = [
        { soNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { emailAddress: { $regex: search, $options: "i" } },
        { invoiceNumber: { $regex: search, $options: "i" } },
      ];
    }

    const orders = await SalesOrder.find(filter)
      .populate('salesPerson', 'name email')
      .populate('customer', 'firstName lastName email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching sales orders",
    });
  }
};

// @desc    Get single sales order
// @route   GET /api/admin/sales-orders/:id
// @access  Private/Admin
const getSalesOrder = async (req, res) => {
  try {
    const order = await SalesOrder.findById(req.params.id)
      .populate('salesPerson', 'name email')
      .populate('customer', 'firstName lastName email phone address');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching sales order",
    });
  }
};

// @desc    Create sales order
// @route   POST /api/admin/sales-orders
// @access  Private/Admin
const createSalesOrder = async (req, res) => {
  try {
    const orderData = req.body;

    // Generate SO Number if not provided
    if (!orderData.soNumber) {
      let soNumber;
      let isUnique = false;
      while (!isUnique) {
        const prefix = 'SO';
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        soNumber = `${prefix}${randomNum}`;
        const exists = await SalesOrder.findOne({ soNumber });
        if (!exists) {
          isUnique = true;
        }
      }
      orderData.soNumber = soNumber;
    } else {
      // Check if SO number already exists
      const exists = await SalesOrder.findOne({ soNumber: orderData.soNumber.toUpperCase() });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: "SO Number already exists",
        });
      }
      orderData.soNumber = orderData.soNumber.toUpperCase();
    }

    // Generate Invoice Number if not provided and status is not Draft
    if (!orderData.invoiceNumber && orderData.orderStatus && orderData.orderStatus !== 'Draft') {
      let invoiceNumber;
      let isUnique = false;
      while (!isUnique) {
        const prefix = 'INV';
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        invoiceNumber = `${prefix}-${randomNum}`;
        const exists = await SalesOrder.findOne({ invoiceNumber });
        if (!exists) {
          isUnique = true;
        }
      }
      orderData.invoiceNumber = invoiceNumber;
    }

    // Convert date strings to Date objects
    if (orderData.orderDate && typeof orderData.orderDate === 'string') {
      orderData.orderDate = new Date(orderData.orderDate);
    }
    if (orderData.expectedDispatchDate && typeof orderData.expectedDispatchDate === 'string') {
      orderData.expectedDispatchDate = new Date(orderData.expectedDispatchDate);
    }
    if (orderData.actualDispatchDate && typeof orderData.actualDispatchDate === 'string') {
      orderData.actualDispatchDate = new Date(orderData.actualDispatchDate);
    }

    // Ensure items have lineTotal calculated
    if (orderData.items && Array.isArray(orderData.items)) {
      orderData.items = orderData.items.map(item => ({
        ...item,
        lineTotal: (item.unitPrice || 0) * (item.quantity || 0),
      }));
    }

    const order = await SalesOrder.create(orderData);

    // 🔁 HUBSPOT SYNC (NON-BLOCKING): create contact + order/deal in HubSpot
    (async () => {
      try {
        console.log(`[HUBSPOT] Syncing SalesOrder to HubSpot: ${order.soNumber}`);
        const customer = {
          firstname: (order.customerName || '').split(' ')[0] || order.customerName || '',
          lastname: (order.customerName || '').split(' ').slice(1).join(' ') || '',
          email: order.emailAddress || '',
          phone: order.phoneNumber || '',
          company: '',
          address: order.billingAddress || '',
          city: '',
          state: '',
          zip: '',
        };

        // Create customer in HubSpot only if we have at least an email or name
        const hasIdentity = !!(customer.email || customer.firstname || customer.lastname);
        let hubspotCustomerId = null;
        if (hasIdentity) {
          // Prefer upsert by email if possible
          if (customer.email) {
            hubspotCustomerId = await hubspotService.findContactByEmail(customer.email);
          }
          if (!hubspotCustomerId) {
            const created = await hubspotService.createOrUpdateContact({
              name: `${customer.firstname} ${customer.lastname}`.trim() || customer.firstname || customer.lastname,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
            });
            hubspotCustomerId = created?.id || null;
          }
        }

        await hubspotService.createOrderInHubSpot(
          {
            name: `Sales Order ${order.soNumber}`,
            amount: String(order.grandTotal || 0),
            status: order.orderStatus || 'COMPLETED',
            description: order.orderNotes || `SO: ${order.soNumber}`,
            closedate: order.orderDate ? new Date(order.orderDate).toISOString() : new Date().toISOString(),
          },
          hubspotCustomerId
        );
        console.log(`[HUBSPOT] SalesOrder synced to HubSpot: ${order.soNumber}`);
      } catch (e) {
        console.error("HubSpot sales order sync error (non-blocking):", e.message);
      }
    })();

    res.status(201).json({
      success: true,
      message: "Sales order created successfully",
      data: order,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "SO Number or Invoice Number already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Error creating sales order",
    });
  }
};

// @desc    Update sales order
// @route   PUT /api/admin/sales-orders/:id
// @access  Private/Admin
const updateSalesOrder = async (req, res) => {
  try {
    let order = await SalesOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    // Generate Invoice Number if status changed to non-Draft and invoice number doesn't exist
    if (req.body.orderStatus && req.body.orderStatus !== 'Draft' && !order.invoiceNumber) {
      let invoiceNumber;
      let isUnique = false;
      while (!isUnique) {
        const prefix = 'INV';
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        invoiceNumber = `${prefix}-${randomNum}`;
        const exists = await SalesOrder.findOne({ invoiceNumber });
        if (!exists) {
          isUnique = true;
        }
      }
      req.body.invoiceNumber = invoiceNumber;
    }

    // Convert date strings to Date objects
    if (req.body.orderDate && typeof req.body.orderDate === 'string') {
      req.body.orderDate = new Date(req.body.orderDate);
    }
    if (req.body.expectedDispatchDate && typeof req.body.expectedDispatchDate === 'string') {
      req.body.expectedDispatchDate = new Date(req.body.expectedDispatchDate);
    }
    if (req.body.actualDispatchDate && typeof req.body.actualDispatchDate === 'string') {
      req.body.actualDispatchDate = new Date(req.body.actualDispatchDate);
    }

    // Ensure items have lineTotal calculated
    if (req.body.items && Array.isArray(req.body.items)) {
      req.body.items = req.body.items.map(item => ({
        ...item,
        lineTotal: (item.unitPrice || 0) * (item.quantity || 0),
      }));
    }

    // Update all fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== '__v') {
        order[key] = req.body[key];
      }
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: "Sales order updated successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error updating sales order",
    });
  }
};

// @desc    Delete sales order
// @route   DELETE /api/admin/sales-orders/:id
// @access  Private/Admin
const deleteSalesOrder = async (req, res) => {
  try {
    const order = await SalesOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    await order.deleteOne();

    res.status(200).json({
      success: true,
      message: "Sales order deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting sales order",
    });
  }
};

module.exports = {
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
};
