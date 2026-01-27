const SalesOrder = require("../../database/models/SalesOrder");
const SalesTarget = require("../../database/models/SalesTarget");
const User = require("../../database/models/User");
const hubspotService = require("../../services/hubspotService");
const { sendOrderApprovalEmail } = require("../../utils/emailService");

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

    // Set approval status based on user role
    const currentUserRole = req.user.role;
    if (currentUserRole === 'salesman') {
      // Salesman-created orders need approval (Pending)
      orderData.approvalStatus = 'Pending';
      orderData.orderStatus = orderData.orderStatus || 'Pending';
      orderData.createdBy = req.user._id;
    } else {
      // Admin-created orders are auto-approved
      orderData.approvalStatus = 'Approved';
      orderData.approvedBy = req.user._id;
      orderData.approvedAt = new Date();
      if (!orderData.orderStatus || orderData.orderStatus === 'Draft') {
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
    }

    const order = await SalesOrder.create(orderData);

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

    // Track previous status to detect approval
    const previousStatus = order.orderStatus;
    const previousSalesPerson = order.salesPerson;

    // Update all fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== '__v') {
        order[key] = req.body[key];
      }
    });

    await order.save();

    // Update monthly sales targets when order status changes to Confirmed (non-blocking)
    const isNewlyConfirmed = order.orderStatus === 'Confirmed' && previousStatus !== 'Confirmed';
    const orderAmount = order.grandTotal || 0;
    const salesPersonId = order.salesPerson || previousSalesPerson;

    if (isNewlyConfirmed && salesPersonId) {
      (async () => {
        try {
          const orderDate = new Date(order.orderDate || order.createdAt || new Date());
          
          // Find ALL active targets for this salesman (both Orders and Revenue types)
          // Check targets that overlap with the order date (not just Monthly)
          const allTargets = await SalesTarget.find({
            salesman: salesPersonId,
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
          // Don't fail the order update if target update fails
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

    // Update monthly sales targets when order is approved (non-blocking)
    const orderAmount = order.grandTotal || 0;
    const salesPersonId = order.salesPerson;

    if (salesPersonId) {
      (async () => {
        try {
          // Use approval date (when order was approved) instead of order date
          // This ensures orders are counted in the month they were approved
          const approvalDate = order.approvedAt || new Date();
          const orderDate = new Date(order.orderDate || order.createdAt || new Date());
          
          // Find ALL active targets for this salesman (both Orders and Revenue types)
          // Check targets that overlap with the approval date (not just Monthly)
          const allTargets = await SalesTarget.find({
            salesman: salesPersonId,
            targetType: { $in: ['Orders', 'Revenue'] },
            status: 'Active',
            startDate: { $lte: approvalDate },
            endDate: { $gte: approvalDate }
          });

          // Update each matching target's currentProgress
          for (const target of allTargets) {
            // Normalize dates to midnight for accurate comparison
            const targetStart = new Date(target.startDate);
            targetStart.setHours(0, 0, 0, 0);
            const targetEnd = new Date(target.endDate);
            targetEnd.setHours(23, 59, 59, 999);
            const approvalDateNormalized = new Date(approvalDate);
            approvalDateNormalized.setHours(12, 0, 0, 0); // Set to noon for safe comparison
            
            // Check if approval date falls within target date range
            // This ensures orders are counted in the period they were approved (Daily, Weekly, Monthly, etc.)
            if (approvalDateNormalized >= targetStart && approvalDateNormalized <= targetEnd) {
              if (target.targetType === 'Orders') {
                // For Orders type: increment count by 1
                target.currentProgress = (target.currentProgress || 0) + 1;
                await target.save();
                console.log(`✅ Sales order ${order.soNumber} approved: 1 order added to ${target.period} Orders target "${target.targetName}" (${target._id})`);
              } else if (target.targetType === 'Revenue' && orderAmount > 0) {
                // For Revenue type: add order amount
                target.currentProgress = (target.currentProgress || 0) + orderAmount;
                await target.save();
                console.log(`✅ Sales order ${order.soNumber} approved: £${orderAmount.toFixed(2)} added to ${target.period} Revenue target "${target.targetName}" (${target._id})`);
              }
            } else {
              console.log(`⚠️ Order ${order.soNumber} approval date (${approvalDateNormalized.toISOString()}) not in target range (${targetStart.toISOString()} - ${targetEnd.toISOString()})`);
            }
          }
        } catch (targetError) {
          console.error('Error updating monthly sales targets:', targetError);
          // Don't fail the order approval if target update fails
        }
      })();
    }

    // Send email notification to all admins (non-blocking)
    (async () => {
      try {
        const admins = await User.find({ role: 'admin', email: { $exists: true, $ne: '' } })
          .select('name email');
        
        if (admins && admins.length > 0) {
          const populatedOrder = await SalesOrder.findById(order._id)
            .populate('salesPerson', 'name email')
            .populate('customer', 'firstName lastName email phone')
            .populate('approvedBy', 'name email');

          const orderDetails = {
            soNumber: populatedOrder.soNumber,
            customerName: populatedOrder.customerName,
            grandTotal: populatedOrder.grandTotal,
            salesPerson: populatedOrder.salesPerson,
            invoiceNumber: populatedOrder.invoiceNumber,
          };

          // Send email to all admins
          for (const admin of admins) {
            if (admin.email) {
              await sendOrderApprovalEmail(admin.email, admin.name || 'Admin', orderDetails);
            }
          }
          console.log(`✅ Order approval emails sent to ${admins.length} admin(s)`);
        }
      } catch (emailError) {
        console.error('Error sending order approval emails:', emailError);
        // Don't fail the order approval if email fails
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
