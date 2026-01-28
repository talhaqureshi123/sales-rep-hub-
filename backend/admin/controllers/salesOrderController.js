const SalesOrder = require("../../database/models/SalesOrder");
const SalesTarget = require("../../database/models/SalesTarget");
const User = require("../../database/models/User");
const hubspotService = require("../../services/hubspotService");
const { sendOrderApprovalEmail } = require("../../utils/emailService");

// @desc    Get all sales orders
// @route   GET /api/admin/sales-orders
// @access  Private/Admin, Salesman
const getSalesOrders = async (req, res) => {
  try {
    const { status, search, salesPerson } = req.query;
    const filter = {};

    // If logged-in user is a salesman, automatically filter by their ID
    // Salesman can only see their own orders
    if (req.user.role === 'salesman') {
      filter.salesPerson = req.user._id;
      console.log(`[Sales Orders] 👤 SALESMAN VIEW - Filter: ${req.user._id} (${req.user.name || req.user.email})`);
    } else {
      // Admin can see ALL orders (no filter by default)
      console.log(`[Sales Orders] 👑 ADMIN VIEW - Showing ALL orders`);
      if (salesPerson) {
        // Admin can filter by any salesPerson (from query param)
        filter.salesPerson = salesPerson;
        console.log(`[Sales Orders] 👑 ADMIN - Filtered by salesPerson: ${salesPerson}`);
      }
    }

    if (status && status !== 'All') {
      filter.orderStatus = status;
      console.log(`[Sales Orders] 📊 Status filter: ${status}`);
    }
    if (search) {
      filter.$or = [
        { soNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { emailAddress: { $regex: search, $options: "i" } },
        { invoiceNumber: { $regex: search, $options: "i" } },
      ];
      console.log(`[Sales Orders] 🔍 Search filter: ${search}`);
    }

    const totalCount = await SalesOrder.countDocuments({});
    const filteredCount = await SalesOrder.countDocuments(filter);
    console.log(`[Sales Orders] 📈 Total orders in DB: ${totalCount}, Filtered: ${filteredCount}`);
    console.log(`[Sales Orders] 🔍 Filter applied:`, JSON.stringify(filter, null, 2));

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

    // Set approval status - ALL orders are auto-approved by default (both admin and salesman)
    orderData.approvalStatus = 'Approved';
    orderData.approvedBy = req.user._id;
    orderData.approvedAt = new Date();
    orderData.createdBy = req.user._id;
    
    // Set order status - if not provided or Draft, set to Confirmed
    if (!orderData.orderStatus || orderData.orderStatus === 'Draft' || orderData.orderStatus === 'Pending') {
      orderData.orderStatus = 'Confirmed';
      // Generate invoice number for confirmed orders
      if (!orderData.invoiceNumber) {
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
    }

    const order = await SalesOrder.create(orderData);

    // Send email notification when order is created and approved (non-blocking)
    if (order.approvalStatus === 'Approved' && order.orderStatus === 'Confirmed') {
      (async () => {
        try {
          const populatedOrder = await SalesOrder.findById(order._id)
            .populate('salesPerson', 'name email')
            .populate('customer', 'firstName lastName email phone')
            .populate('approvedBy', 'name email');

          const orderDetails = {
            soNumber: populatedOrder.soNumber,
            orderDate: populatedOrder.orderDate,
            orderStatus: populatedOrder.orderStatus,
            poNumber: populatedOrder.poNumber,
            customerName: populatedOrder.customerName,
            contactPerson: populatedOrder.contactPerson,
            emailAddress: populatedOrder.emailAddress,
            phoneNumber: populatedOrder.phoneNumber,
            billingAddress: populatedOrder.billingAddress,
            salesPerson: populatedOrder.salesPerson,
            invoiceNumber: populatedOrder.invoiceNumber,
            items: populatedOrder.items,
            subtotal: populatedOrder.subtotal,
            discount: populatedOrder.discount,
            deliveryCharges: populatedOrder.deliveryCharges,
            vat: populatedOrder.vat,
            vatRate: populatedOrder.vatRate,
            grandTotal: populatedOrder.grandTotal,
            paymentMethod: populatedOrder.paymentMethod,
            amountPaid: populatedOrder.amountPaid,
            balanceRemaining: populatedOrder.balanceRemaining,
          };

          const APPROVAL_EMAIL = 'iotfiy.solution@gmail.com';
          await sendOrderApprovalEmail(APPROVAL_EMAIL, 'Admin', orderDetails);
          console.log('✅ Order creation email sent to', APPROVAL_EMAIL);
        } catch (emailError) {
          console.error('Error sending order creation email:', emailError);
        }
      })();
    }

    // Update monthly sales targets when order is confirmed (non-blocking)
    if (order.orderStatus === 'Confirmed' && order.salesPerson) {
      (async () => {
        try {
          const orderDate = new Date(order.orderDate || order.createdAt);
          const orderAmount = order.grandTotal || 0;
          
          // Find ALL active targets for this salesman (both Orders and Revenue types)
          // Check targets that overlap with the order date (not just Monthly)
          const allTargets = await SalesTarget.find({
            salesman: order.salesPerson,
            targetType: { $in: ['Orders', 'Revenue'] },
            status: 'Active',
            startDate: { $lte: orderDate },
            endDate: { $gte: orderDate }
          });

          // Update each matching target's currentProgress
          for (const target of allTargets) {
            // Normalize dates for accurate comparison
            const targetStart = new Date(target.startDate);
            targetStart.setHours(0, 0, 0, 0);
            const targetEnd = new Date(target.endDate);
            targetEnd.setHours(23, 59, 59, 999);
            const orderDateNormalized = new Date(orderDate);
            orderDateNormalized.setHours(12, 0, 0, 0);
            
            // Check if order date falls within target date range
            if (orderDateNormalized >= targetStart && orderDateNormalized <= targetEnd) {
              if (target.targetType === 'Orders') {
                // For Orders type: increment count by 1
                target.currentProgress = (target.currentProgress || 0) + 1;
                await target.save();
                console.log(`✅ Sales order ${order.soNumber} confirmed: 1 order added to ${target.period} Orders target "${target.targetName}" (${target._id})`);
              } else if (target.targetType === 'Revenue' && orderAmount > 0) {
                // For Revenue type: add order amount
                target.currentProgress = (target.currentProgress || 0) + orderAmount;
                await target.save();
                console.log(`✅ Sales order ${order.soNumber} confirmed: £${orderAmount.toFixed(2)} added to ${target.period} Revenue target "${target.targetName}" (${target._id})`);
              }
            }
          }
        } catch (targetError) {
          console.error('Error updating monthly sales targets:', targetError);
          // Don't fail the order creation if target update fails
        }
      })();
    }

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

    // Track previous status to detect when order becomes Delivered (complete)
    const previousStatus = order.orderStatus;
    const previousSalesPerson = order.salesPerson;

    // Update all fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== '__v') {
        order[key] = req.body[key];
      }
    });

    await order.save();

    // Update sales targets when order reaches a counted status: Confirmed, Processing, Dispatched, Delivered
    // Only count once when order first reaches any of these statuses (not when moving between them)
    const countedStatuses = ['Confirmed', 'Processing', 'Dispatched', 'Delivered'];
    const wasNotCounted = !countedStatuses.includes(previousStatus);
    const isNowCounted = countedStatuses.includes(order.orderStatus);
    const shouldUpdateTarget = wasNotCounted && isNowCounted; // First time reaching a counted status
    
    const orderAmount = order.grandTotal || 0;
    const salesPersonId = order.salesPerson || previousSalesPerson;

    if (shouldUpdateTarget && salesPersonId) {
      (async () => {
        try {
          const orderDate = new Date(order.orderDate || order.createdAt || new Date());
          
          const allTargets = await SalesTarget.find({
            salesman: salesPersonId,
            targetType: { $in: ['Orders', 'Revenue'] },
            status: 'Active',
            startDate: { $lte: orderDate },
            endDate: { $gte: orderDate }
          });

          for (const target of allTargets) {
            const targetStart = new Date(target.startDate);
            targetStart.setHours(0, 0, 0, 0);
            const targetEnd = new Date(target.endDate);
            targetEnd.setHours(23, 59, 59, 999);
            const orderDateNormalized = new Date(orderDate);
            orderDateNormalized.setHours(12, 0, 0, 0);
            
            if (orderDateNormalized >= targetStart && orderDateNormalized <= targetEnd) {
              if (target.targetType === 'Orders') {
                target.currentProgress = (target.currentProgress || 0) + 1;
                await target.save();
                console.log(`✅ Sales order ${order.soNumber} (${order.orderStatus}): 1 order added to ${target.period} Orders target "${target.targetName}" (${target._id})`);
              } else if (target.targetType === 'Revenue' && orderAmount > 0) {
                target.currentProgress = (target.currentProgress || 0) + orderAmount;
                await target.save();
                console.log(`✅ Sales order ${order.soNumber} (${order.orderStatus}): £${orderAmount.toFixed(2)} added to ${target.period} Revenue target "${target.targetName}" (${target._id})`);
              }
            }
          }
        } catch (targetError) {
          console.error('Error updating sales targets:', targetError);
        }
      })();
    }

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

// @desc    Approve sales order
// @route   PUT /api/admin/sales-orders/:id/approve
// @access  Private/Admin
const approveSalesOrder = async (req, res) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Sales order not found',
      });
    }

    if (order.approvalStatus === 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Sales order is already approved',
      });
    }

    order.approvalStatus = 'Approved';
    order.approvedBy = req.user._id;
    order.approvedAt = new Date();
    order.orderStatus = 'Confirmed'; // Set order status to Confirmed when approved
    
    // Generate invoice number if not exists
    if (!order.invoiceNumber) {
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
      order.invoiceNumber = invoiceNumber;
    }

    // Clear rejection fields
    order.rejectedBy = undefined;
    order.rejectedAt = undefined;
    order.rejectionReason = undefined;

    await order.save();

    // Sales targets are updated only when order is marked Delivered (see updateSalesOrder).

    // Send email notification to talhaabid400@gmail.com (non-blocking)
    const APPROVAL_EMAIL = 'talhaabid400@gmail.com';
    (async () => {
      try {
        const populatedOrder = await SalesOrder.findById(order._id)
          .populate('salesPerson', 'name email')
          .populate('customer', 'firstName lastName email phone')
          .populate('approvedBy', 'name email');

        const orderDetails = {
          soNumber: populatedOrder.soNumber,
          orderDate: populatedOrder.orderDate,
          orderStatus: populatedOrder.orderStatus,
          poNumber: populatedOrder.poNumber,
          customerName: populatedOrder.customerName,
          contactPerson: populatedOrder.contactPerson,
          emailAddress: populatedOrder.emailAddress,
          phoneNumber: populatedOrder.phoneNumber,
          billingAddress: populatedOrder.billingAddress,
          salesPerson: populatedOrder.salesPerson,
          invoiceNumber: populatedOrder.invoiceNumber,
          items: populatedOrder.items,
          subtotal: populatedOrder.subtotal,
          discount: populatedOrder.discount,
          deliveryCharges: populatedOrder.deliveryCharges,
          vat: populatedOrder.vat,
          vatRate: populatedOrder.vatRate,
          grandTotal: populatedOrder.grandTotal,
          paymentMethod: populatedOrder.paymentMethod,
          amountPaid: populatedOrder.amountPaid,
          balanceRemaining: populatedOrder.balanceRemaining,
        };

        await sendOrderApprovalEmail(APPROVAL_EMAIL, 'Admin', orderDetails);
        console.log('✅ Order approval email sent to', APPROVAL_EMAIL);
      } catch (emailError) {
        console.error('Error sending order approval email:', emailError);
      }
    })();

    const populatedOrder = await SalesOrder.findById(order._id)
      .populate('salesPerson', 'name email')
      .populate('customer', 'firstName lastName email phone')
      .populate('approvedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Sales order approved successfully',
      data: populatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error approving sales order',
    });
  }
};

// @desc    Reject sales order
// @route   PUT /api/admin/sales-orders/:id/reject
// @access  Private/Admin
const rejectSalesOrder = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const order = await SalesOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Sales order not found',
      });
    }

    if (order.approvalStatus === 'Rejected') {
      return res.status(400).json({
        success: false,
        message: 'Sales order is already rejected',
      });
    }

    order.approvalStatus = 'Rejected';
    order.rejectedBy = req.user._id;
    order.rejectedAt = new Date();
    order.rejectionReason = rejectionReason || '';
    order.orderStatus = 'Cancelled'; // Set order status to Cancelled when rejected

    // Clear approval fields
    order.approvedBy = undefined;
    order.approvedAt = undefined;

    await order.save();

    const populatedOrder = await SalesOrder.findById(order._id)
      .populate('salesPerson', 'name email')
      .populate('customer', 'firstName lastName email phone')
      .populate('rejectedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Sales order rejected successfully',
      data: populatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting sales order',
    });
  }
};

module.exports = {
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
  approveSalesOrder,
  rejectSalesOrder,
};
