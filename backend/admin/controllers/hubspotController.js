const hubspotService = require('../../services/hubspotService');
const Customer = require('../../database/models/Customer');
const FollowUp = require('../../database/models/FollowUp');
const SalesOrder = require('../../database/models/SalesOrder');

// @desc    Create customer and order in HubSpot
// @route   POST /api/admin/hubspot/create-order
// @access  Private/Admin
const createCustomerAndOrder = async (req, res) => {
  try {
    const { customer, order } = req.body;

    if (!customer || !order) {
      return res.status(400).json({
        success: false,
        message: 'Customer and order data are required',
      });
    }

    // Step 1: Create customer in HubSpot
    const customerId = await hubspotService.createCustomerInHubSpot(customer);
    if (!customerId) {
      return res.status(500).json({
        success: false,
        message: 'Customer creation failed in HubSpot',
      });
    }

    // Step 2: Create order linked to customer
    const orderId = await hubspotService.createOrderInHubSpot(order, customerId);
    if (!orderId) {
      return res.status(500).json({
        success: false,
        message: 'Order creation failed in HubSpot',
        customerId, // Return customerId even if order fails
      });
    }

    res.status(201).json({
      success: true,
      message: 'Customer & Order created successfully in HubSpot',
      data: {
        customerId,
        orderId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating customer and order in HubSpot',
    });
  }
};

// @desc    Fetch customers from HubSpot
// @route   GET /api/admin/hubspot/customers
// @access  Private/Admin
const getHubSpotCustomers = async (req, res) => {
  try {
    console.log('=== HUBSPOT CUSTOMERS ENDPOINT CALLED ===');
    console.log('Request received at:', new Date().toISOString());
    console.log('User:', req.user?.id);
    
    const customers = await hubspotService.fetchCustomers();

    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    console.error('Error in getHubSpotCustomers controller:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error fetching customers from HubSpot',
      error: error.data || error.originalError,
      status: error.status,
    });
  }
};

// @desc    Fetch orders from HubSpot
// @route   GET /api/admin/hubspot/orders
// @access  Private/Admin
const getHubSpotOrders = async (req, res) => {
  try {
    console.log('=== HUBSPOT ORDERS ENDPOINT CALLED ===');
    console.log('Request received at:', new Date().toISOString());
    console.log('User:', req.user?.id);
    
    const orders = await hubspotService.fetchOrders();

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error('Error in getHubSpotOrders controller:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error fetching orders from HubSpot',
      error: error.data || error.originalError,
      status: error.status,
    });
  }
};

// @desc    Sync HubSpot data (customers and orders)
// @route   POST /api/admin/hubspot/sync
// @access  Private/Admin
const syncHubSpotData = async (req, res) => {
  try {
    const syncResult = await hubspotService.syncHubSpotData();

    res.status(200).json({
      success: true,
      message: 'HubSpot data synced successfully',
      data: syncResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error syncing HubSpot data',
    });
  }
};

// @desc    Create task in HubSpot
// @route   POST /api/admin/hubspot/tasks
// @access  Private/Admin
const createHubSpotTask = async (req, res) => {
  try {
    const { subject, contactId } = req.body;

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: 'Task subject is required',
      });
    }

    const task = await hubspotService.createTaskInHubSpot(subject, contactId);

    if (!task) {
      return res.status(500).json({
        success: false,
        message: 'Task creation failed in HubSpot',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully in HubSpot',
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating task in HubSpot',
    });
  }
};

// @desc    Test HubSpot connection
// @route   GET /api/admin/hubspot/test
// @access  Private/Admin
const testHubSpotConnection = async (req, res) => {
  try {
    console.log('=== HUBSPOT TEST ENDPOINT CALLED ===');
    console.log('Request received at:', new Date().toISOString());
    console.log('User:', req.user?.id);
    
    const config = require('../../enviornment/config');
    const axios = require('axios');
    const hubspotOAuthService = require('../../services/hubspotOAuthService');

    // Choose token source based on auth mode
    let token = '';
    if (config.HUBSPOT_AUTH_MODE === 'oauth') {
      try {
        token = await hubspotOAuthService.getValidAccessToken();
      } catch (e) {
        token = '';
      }
    } else {
      token = config.HUBSPOT_TOKEN || config.HUBSPOT_ACCESS_TOKEN || config.HUBSPOT_API_KEY;
    }

    const hasToken = !!token;
    
    if (!hasToken) {
      return res.status(400).json({
        success: false,
        message: 'HubSpot API token not configured',
        config: {
          hasToken: false,
          hubspotEnabled: config.HUBSPOT_ENABLED,
          hint: 'Please add HUBSPOT_ACCESS_TOKEN or HUBSPOT_API_KEY to .env file',
        },
      });
    }

    // Direct API test
    let directTestResult = null;
    try {
      const testResponse = await axios.get(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            limit: 1,
            properties: 'email,firstname,lastname'
          }
        }
      );
      directTestResult = {
        success: true,
        status: testResponse.status,
        dataCount: testResponse.data?.results?.length || 0,
        hasPaging: !!testResponse.data?.paging,
      };
    } catch (directError) {
      directTestResult = {
        success: false,
        status: directError.response?.status,
        message: directError.response?.data?.message || directError.message,
        error: directError.response?.data,
      };
    }

    // Try to fetch data to test connection
    let customers = [];
    let orders = [];
    let customerError = null;
    let orderError = null;

    try {
      customers = await hubspotService.fetchCustomers();
    } catch (err) {
      customerError = {
        message: err.message,
        status: err.status,
        data: err.data,
      };
    }

    try {
      orders = await hubspotService.fetchOrders();
    } catch (err) {
      orderError = {
        message: err.message,
        status: err.status,
        data: err.data,
      };
    }

    res.status(200).json({
      success: true,
      message: 'HubSpot connection test completed',
      config: {
        authMode: config.HUBSPOT_AUTH_MODE,
        hasToken: true,
        hubspotEnabled: config.HUBSPOT_ENABLED,
        tokenLength: token.length,
      },
      directApiTest: directTestResult,
      testResults: {
        customers: {
          fetched: customers.length,
          error: customerError,
          sample: customers.length > 0 ? customers[0] : null,
        },
        orders: {
          fetched: orders.length,
          error: orderError,
          sample: orders.length > 0 ? orders[0] : null,
        },
        connectionStatus: customerError && orderError ? 'Failed' : 'Connected',
      },
    });
  } catch (error) {
    console.error('Error in testHubSpotConnection:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error testing HubSpot connection',
      error: error.response?.data || error.message,
    });
  }
};

// @desc    Import HubSpot contacts into local Customers (MongoDB)
// @route   POST /api/admin/hubspot/import-customers
// @access  Private/Admin
const importHubSpotCustomersToDb = async (req, res) => {
  try {
    const hubspotContacts = await hubspotService.fetchCustomers();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const c of hubspotContacts) {
      const p = c?.properties || {};
      const email = (p.email || '').toLowerCase().trim();
      if (!email) {
        skipped += 1;
        continue;
      }

      const firstname = (p.firstname || '').trim();
      const lastname = (p.lastname || '').trim();
      const fullName = `${firstname} ${lastname}`.trim();

      // Customer schema requires firstName and createdBy.
      const firstName =
        firstname ||
        lastname ||
        (email.includes('@') ? email.split('@')[0] : 'Customer');

      const payload = {
        firstName,
        name: fullName || firstName,
        email,
        phone: (p.phone || '').trim(),
        address: p.address || '',
        city: p.city || '',
        state: p.state || '',
        pincode: p.zip || '',
        company: p.company || '',
        // Keep existing status if already in DB; default for new is Not Visited
        createdBy: req.user?._id,
      };

      const existing = await Customer.findOne({ email });
      if (existing) {
        // Don't overwrite createdBy/assignedSalesman/status unless missing
        existing.firstName = payload.firstName || existing.firstName;
        existing.name = payload.name || existing.name;
        existing.phone = payload.phone || existing.phone;
        existing.address = payload.address || existing.address;
        existing.city = payload.city || existing.city;
        existing.state = payload.state || existing.state;
        existing.pincode = payload.pincode || existing.pincode;
        existing.company = payload.company || existing.company;
        await existing.save();
        updated += 1;
      } else {
        await Customer.create({
          ...payload,
          status: 'Not Visited',
          assignedSalesman: null,
        });
        created += 1;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'HubSpot contacts imported to Customers successfully',
      data: {
        fetchedFromHubSpot: hubspotContacts.length,
        created,
        updated,
        skipped,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error importing HubSpot customers to DB',
    });
  }
};

// @desc    Import HubSpot tasks into local FollowUps (MongoDB)
// @route   POST /api/admin/hubspot/import-tasks
// @access  Private/Admin
const importHubSpotTasksToDb = async (req, res) => {
  try {
    const hubspotTasks = await hubspotService.fetchTasks();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const t of hubspotTasks) {
      const taskId = String(t?.id || '').trim();
      if (!taskId) {
        skipped += 1;
        continue;
      }

      const p = t?.properties || {};
      const subject = (p.hs_task_subject || '').trim();
      const body = (p.hs_task_body || '').trim();
      const hsStatus = (p.hs_task_status || '').trim();
      const hsPriority = (p.hs_task_priority || '').trim();
      const hsType = (p.hs_task_type || '').trim();

      // Due date: hs_timestamp is typically epoch millis
      let dueDate = null;
      const tsRaw = p.hs_timestamp;
      const tsNum = tsRaw !== undefined && tsRaw !== null ? Number(tsRaw) : NaN;
      if (!Number.isNaN(tsNum) && tsNum > 0) {
        dueDate = new Date(tsNum);
      } else {
        // fallback to created date if no due date
        const createdRaw = p.hs_createdate;
        const createdMs = createdRaw ? Date.parse(createdRaw) : NaN;
        dueDate = Number.isNaN(createdMs) ? new Date() : new Date(createdMs);
      }

      // Map HubSpot priority to our enum
      let priority = 'Medium';
      const pr = hsPriority.toLowerCase();
      if (pr.includes('high')) priority = 'High';
      else if (pr.includes('urgent')) priority = 'Urgent';
      else if (pr.includes('low')) priority = 'Low';

      // Map HubSpot type to our enum
      let type = 'Call';
      const ty = hsType.toLowerCase();
      if (ty.includes('email')) type = 'Email';
      else if (ty.includes('visit') || ty.includes('meeting')) type = 'Visit';

      // Resolve associated contact (if any) -> find customer in DB by email when possible
      let customer = null;
      let customerName = 'HubSpot Contact';
      let customerEmail = '';
      let customerPhone = '';

      const contactAssoc = t?.associations?.contacts?.results || [];
      const contactId = contactAssoc.length > 0 ? contactAssoc[0].id : null;

      if (contactId) {
        try {
          // Fetch contact details (email/name/phone)
          const headers = await (async () => {
            // use existing hubspotService auth via creating a trivial call
            // we can reuse fetchCustomers search, but this is lighter
            const cfg = require('../../enviornment/config');
            const hubspotOAuthService = require('../../services/hubspotOAuthService');
            let token = '';
            if (cfg.HUBSPOT_AUTH_MODE === 'oauth') {
              token = await hubspotOAuthService.getValidAccessToken();
            } else {
              token = cfg.HUBSPOT_TOKEN || cfg.HUBSPOT_ACCESS_TOKEN || cfg.HUBSPOT_API_KEY;
            }
            return {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            };
          })();

          const axios = require('axios');
          const contactRes = await axios.get(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
            { headers, params: { properties: 'firstname,lastname,email,phone' } }
          );
          const cp = contactRes.data?.properties || {};
          customerEmail = (cp.email || '').toLowerCase().trim();
          customerPhone = (cp.phone || '').trim();
          customerName = `${cp.firstname || ''} ${cp.lastname || ''}`.trim() || customerEmail || customerName;
          if (customerEmail) {
            customer = await Customer.findOne({ email: customerEmail });
          }
        } catch (e) {
          // ignore contact fetch failures
        }
      }

      // Upsert follow-up by hubspotTaskId
      const existing = await FollowUp.findOne({ hubspotTaskId: taskId });

      const payload = {
        hubspotTaskId: taskId,
        salesman: req.user?._id,
        customer: customer?._id || undefined,
        customerName,
        customerEmail,
        customerPhone,
        type,
        priority,
        scheduledDate: dueDate,
        dueDate,
        description: subject || body || `HubSpot Task ${taskId}`,
        notes: body || '',
        createdBy: req.user?._id,
      };

      // If completed, mark completed; otherwise pre-save hook will compute Overdue/Today/Upcoming
      if (hsStatus.toLowerCase().includes('complete')) {
        payload.status = 'Completed';
        payload.completedDate = new Date();
      }

      if (existing) {
        // Update safe fields only
        existing.customer = payload.customer ?? existing.customer;
        existing.customerName = payload.customerName || existing.customerName;
        existing.customerEmail = payload.customerEmail || existing.customerEmail;
        existing.customerPhone = payload.customerPhone || existing.customerPhone;
        existing.type = payload.type || existing.type;
        existing.priority = payload.priority || existing.priority;
        existing.scheduledDate = payload.scheduledDate || existing.scheduledDate;
        existing.dueDate = payload.dueDate || existing.dueDate;
        existing.description = payload.description || existing.description;
        existing.notes = payload.notes || existing.notes;
        if (payload.status) existing.status = payload.status;
        if (payload.completedDate) existing.completedDate = payload.completedDate;
        await existing.save();
        updated += 1;
      } else {
        await FollowUp.create(payload);
        created += 1;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'HubSpot tasks imported to Follow-Ups successfully',
      data: {
        fetchedFromHubSpot: hubspotTasks.length,
        created,
        updated,
        skipped,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error importing HubSpot tasks to DB',
    });
  }
};

// @desc    Debug: List required properties for HubSpot Orders object
// @route   GET /api/admin/hubspot/orders-required
// @access  Private/Admin
const getHubSpotOrdersRequiredFields = async (req, res) => {
  try {
    const axios = require('axios');
    const config = require('../../enviornment/config');
    const hubspotOAuthService = require('../../services/hubspotOAuthService');

    let token = '';
    if (config.HUBSPOT_AUTH_MODE === 'oauth') {
      token = await hubspotOAuthService.getValidAccessToken();
    } else {
      token = config.HUBSPOT_TOKEN || config.HUBSPOT_ACCESS_TOKEN || config.HUBSPOT_API_KEY;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const propsRes = await axios.get('https://api.hubapi.com/crm/v3/properties/orders', { headers });
    const props = propsRes.data?.results || [];
    const required = props
      .filter((p) => p?.required && !p?.readOnly)
      .map((p) => ({
        name: p.name,
        label: p.label,
        type: p.type,
        fieldType: p.fieldType,
        options: (p.options || []).slice(0, 5).map((o) => o.value),
      }));

    return res.status(200).json({
      success: true,
      count: required.length,
      data: required,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Error fetching orders required fields',
      error: error.response?.data,
    });
  }
};

// @desc    Push existing website SalesOrders to HubSpot Orders
// @route   POST /api/admin/hubspot/push-orders
// @access  Private/Admin
// Body: { force?: boolean, limit?: number }
const pushSalesOrdersToHubSpot = async (req, res) => {
  try {
    const force = !!req.body?.force;
    const limit = Number(req.body?.limit || 0);

    // Auto behavior:
    // - if hubspotOrderId missing: create order and associate
    // - if hubspotOrderId exists AND previous sync error mentions association/404: retry association (no duplicates)
    const query = force
      ? {}
      : {
          $or: [
            { hubspotOrderId: { $exists: false } },
            { hubspotOrderId: '' },
            { hubspotLastSyncError: /associat|404/i },
          ],
        };
    let q = SalesOrder.find(query).sort({ createdAt: -1 });
    if (limit && !Number.isNaN(limit)) q = q.limit(limit);
    const orders = await q;

    let attempted = 0;
    let synced = 0;
    let skipped = 0;
    const failures = [];

    for (const order of orders) {
      attempted += 1;

      try {
        // Build contact info from order
        const customerName = order.customerName || '';
        const firstname = customerName.split(' ')[0] || customerName || '';
        const lastname = customerName.split(' ').slice(1).join(' ') || '';
        const email = (order.emailAddress || '').toLowerCase().trim();
        const phone = (order.phoneNumber || '').trim();

        let contactId = null;
        if (email) {
          contactId = await hubspotService.findContactByEmail(email);
        }
        if (!contactId && (firstname || lastname || email)) {
          const contact = await hubspotService.createOrUpdateContact({
            name: `${firstname} ${lastname}`.trim() || firstname || lastname || email,
            email,
            phone,
            address: order.billingAddress || '',
          });
          contactId = contact?.id || null;
        }

        // If we already have a HubSpot Order ID, do not create duplicates.
        // Just ensure association is in place (idempotent on HubSpot side).
        let hubspotOrderId = order.hubspotOrderId || null;

        if (!hubspotOrderId || force) {
          hubspotOrderId = await hubspotService.createOrderInHubSpot(
            {
              name: `Sales Order ${order.soNumber}`,
              amount: String(order.grandTotal || 0),
              status: order.orderStatus || 'COMPLETED',
              description: order.orderNotes || `SO: ${order.soNumber}`,
              closedate: order.orderDate ? new Date(order.orderDate).toISOString() : new Date().toISOString(),
            },
            contactId
          );
        }

        if (!hubspotOrderId) {
          order.hubspotLastSyncError = 'HubSpot order creation failed (no id returned)';
          order.hubspotLastSyncedAt = new Date();
          await order.save();
          failures.push({ soNumber: order.soNumber, message: order.hubspotLastSyncError });
          continue;
        }

        // Always attempt association (safe to retry).
        if (contactId && hubspotOrderId) {
          const ok = await hubspotService.associateOrderToContact(hubspotOrderId, contactId);
          if (!ok) {
            order.hubspotLastSyncError = 'Association failed (will auto-retry on next push-orders)';
          } else {
            order.hubspotLastSyncError = '';
          }
        } else if (!contactId) {
          order.hubspotLastSyncError = 'No contactId available to associate';
        }

        order.hubspotOrderId = hubspotOrderId;
        order.hubspotLastSyncedAt = new Date();
        await order.save();
        synced += 1;
      } catch (e) {
        const msg = e.response?.data?.message || e.message || 'Unknown error';
        try {
          order.hubspotLastSyncError = msg;
          order.hubspotLastSyncedAt = new Date();
          await order.save();
        } catch (_) {}
        failures.push({ soNumber: order.soNumber, message: msg });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Sales orders push to HubSpot completed',
      data: {
        force,
        attempted,
        synced,
        skipped,
        failed: failures.length,
        failures,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error pushing sales orders to HubSpot',
    });
  }
};

// @desc    Repair associations for already-synced SalesOrders (order -> contact)
// @route   POST /api/admin/hubspot/repair-order-associations
// @access  Private/Admin
// Body: { limit?: number }
const repairOrderAssociations = async (req, res) => {
  try {
    const limit = Number(req.body?.limit || 0);

    const query = { hubspotOrderId: { $exists: true, $ne: '' } };
    let q = SalesOrder.find(query).sort({ updatedAt: -1 });
    if (limit && !Number.isNaN(limit)) q = q.limit(limit);
    const orders = await q;

    let attempted = 0;
    let associated = 0;
    const failures = [];

    for (const order of orders) {
      attempted += 1;
      try {
        const email = (order.emailAddress || '').toLowerCase().trim();
        const phone = (order.phoneNumber || '').trim();
        const customerName = order.customerName || '';
        const firstname = customerName.split(' ')[0] || customerName || '';
        const lastname = customerName.split(' ').slice(1).join(' ') || '';

        let contactId = null;
        if (email) contactId = await hubspotService.findContactByEmail(email);
        if (!contactId && (firstname || lastname || email)) {
          const contact = await hubspotService.createOrUpdateContact({
            name: `${firstname} ${lastname}`.trim() || firstname || lastname || email,
            email,
            phone,
            address: order.billingAddress || '',
          });
          contactId = contact?.id || null;
        }

        if (!contactId) {
          failures.push({ soNumber: order.soNumber, message: 'Could not resolve/create HubSpot contact for association' });
          continue;
        }

        const ok = await hubspotService.associateOrderToContact(order.hubspotOrderId, contactId);
        order.hubspotLastSyncedAt = new Date();
        if (ok) {
          associated += 1;
          order.hubspotLastSyncError = '';
        } else {
          const msg = 'Association failed (see server logs)';
          order.hubspotLastSyncError = msg;
          failures.push({ soNumber: order.soNumber, message: msg });
        }
        await order.save();
      } catch (e) {
        const msg = e.response?.data?.message || e.message || 'Unknown error';
        try {
          order.hubspotLastSyncError = msg;
          order.hubspotLastSyncedAt = new Date();
          await order.save();
        } catch (_) {}
        failures.push({ soNumber: order.soNumber, message: msg });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Repair order associations completed',
      data: {
        attempted,
        associated,
        failed: failures.length,
        failures,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error repairing order associations',
    });
  }
};

// @desc    Push existing Customers from website DB to HubSpot Contacts
// @route   POST /api/admin/hubspot/push-customers
// @access  Private/Admin
const pushCustomersToHubSpot = async (req, res) => {
  try {
    const force = Boolean(req.body?.force || false);
    const limit = Number(req.body?.limit || 0);

    let q = Customer.find({}).sort({ updatedAt: -1 });
    if (limit && !Number.isNaN(limit)) q = q.limit(limit);
    const customers = await q;

    let attempted = 0;
    let synced = 0;
    let skipped = 0;
    const failures = [];

    for (const c of customers) {
      attempted += 1;
      try {
        const email = String(c.email || '').trim().toLowerCase();
        const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        // Strongly prefer email-based upsert to avoid duplicates
        if (!hasValidEmail) {
          skipped += 1;
          continue;
        }

        const name = c.firstName || c.name || (email ? email.split('@')[0] : 'Customer');

        // createOrUpdateContact already searches by email and updates if exists
        const hsContact = await hubspotService.createOrUpdateContact({
          name,
          email,
          phone: c.phone,
          address: c.address,
          city: c.city,
          state: c.state,
          pincode: c.postcode || c.pincode,
          company: c.company,
          status: c.status,
          notes: c.notes,
          force,
        });

        if (hsContact?.id) {
          synced += 1;
        } else {
          failures.push({ customerId: c._id, email, message: 'HubSpot contact sync returned null' });
        }
      } catch (e) {
        const msg = e.response?.data?.message || e.message || 'Unknown error';
        failures.push({ customerId: c._id, email: c.email, message: msg });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Customers push to HubSpot completed',
      data: {
        attempted,
        synced,
        skippedNoValidEmail: skipped,
        failed: failures.length,
        failures,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error pushing customers to HubSpot',
    });
  }
};

module.exports = {
  createCustomerAndOrder,
  getHubSpotCustomers,
  getHubSpotOrders,
  syncHubSpotData,
  createHubSpotTask,
  testHubSpotConnection,
  importHubSpotCustomersToDb,
  importHubSpotTasksToDb,
  getHubSpotOrdersRequiredFields,
  pushSalesOrdersToHubSpot,
  pushCustomersToHubSpot,
  repairOrderAssociations,
};
