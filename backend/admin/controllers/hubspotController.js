const hubspotService = require('../../services/hubspotService');
const Customer = require('../../database/models/Customer');
const FollowUp = require('../../database/models/FollowUp');
const SalesOrder = require('../../database/models/SalesOrder');
const User = require('../../database/models/User');

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
// Query params: myContactsOnly (true/false) - If true, only fetch contacts owned by current user
const getHubSpotCustomers = async (req, res) => {
  try {
    console.log('=== HUBSPOT CUSTOMERS ENDPOINT CALLED ===');
    console.log('Request received at:', new Date().toISOString());
    console.log('User:', req.user?.id);
    
    const myContactsOnly = req.query.myContactsOnly === 'true' || req.query.myContactsOnly === true;
    console.log('My Contacts Only:', myContactsOnly);
    
    const customers = await hubspotService.fetchCustomers({ myContactsOnly });

    // If myContactsOnly was requested but we got 0 results, check if user ID detection failed
    if (myContactsOnly && customers.length === 0) {
      const currentUserId = await hubspotService.getCurrentHubSpotUserId();
      if (!currentUserId) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          myContactsOnly: true,
          warning: 'Could not determine your HubSpot owner ID. This usually happens with Private App tokens. "My Contacts" filter requires knowing your owner ID.',
          suggestion: 'Try using OAuth authentication instead of Private App token, or check backend logs for details.',
        });
      }
    }

    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
      myContactsOnly,
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
    
    const config = require('../../config');
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
// Body params: myContactsOnly (boolean) - If true, only import contacts owned by current user
const importHubSpotCustomersToDb = async (req, res) => {
  try {
    const myContactsOnly = req.body?.myContactsOnly === true || req.body?.myContactsOnly === 'true';
    console.log('Importing HubSpot customers (My Contacts Only:', myContactsOnly, ')');
    
    const hubspotContacts = await hubspotService.fetchCustomers({ myContactsOnly });

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
        source: 'hubspot', // Mark as imported from HubSpot
        // Keep existing status if already in DB; default for new is Not Visited
        createdBy: req.user?._id,
      };

      const existing = await Customer.findOne({ email });
      if (existing) {
        // Don't overwrite createdBy/status unless missing
        existing.firstName = payload.firstName || existing.firstName;
        existing.name = payload.name || existing.name;
        existing.phone = payload.phone || existing.phone;
        existing.address = payload.address || existing.address;
        existing.city = payload.city || existing.city;
        existing.state = payload.state || existing.state;
        existing.pincode = payload.pincode || existing.pincode;
        existing.company = payload.company || existing.company;
        existing.source = 'hubspot'; // Mark as HubSpot source
        await existing.save();
        updated += 1;
      } else {
        await Customer.create({
          ...payload,
          status: 'Not Visited',
          // REMOVED: assignedSalesman - Customers and Salesmen are separate
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
    // Get options from request body (default: limit 100, max: 100, currentMonthOnly: true, weekWise: true)
    // HubSpot API allows maximum 100 objects per request
    // Tasks will be imported: Current month weeks (previous week, current week, next week) by default
    const limit = Math.min(Number(req.body?.limit || 100), 100);
    const currentMonthOnly = req.body?.currentMonthOnly !== false; // Default to true - import current month weeks
    const weekWise = req.body?.weekWise !== false; // Default to true - use week-wise filtering
    
    console.log(`Importing HubSpot tasks (Current Month Only: ${currentMonthOnly}, Week Wise: ${weekWise}, Limit: ${limit})`);
    
    const hubspotTasks = await hubspotService.fetchTasks({ limit, currentMonthOnly, weekWise });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const totalTasks = hubspotTasks.length;
    
    console.log(`\n🚀 Starting import of ${totalTasks} tasks...\n`);

    for (let i = 0; i < hubspotTasks.length; i++) {
      const t = hubspotTasks[i];
      const progress = `[${i + 1}/${totalTasks}]`;
      
      // Log progress every 10 tasks
      if ((i + 1) % 10 === 0 || i === 0) {
        console.log(`\n📊 Progress: ${progress} (${created} created, ${updated} updated, ${skipped} skipped)`);
      }
      const taskId = String(t?.id || '').trim();
      if (!taskId) {
        skipped += 1;
        console.log(`${progress} ⏭️  Skipped: No task ID`);
        continue;
      }

      const p = t?.properties || {};
      const subject = (p.hs_task_subject || '').trim();
      const body = (p.hs_task_body || '').trim();
      
      // Log task being processed (especially for debugging missing tasks)
      if (subject && subject.toLowerCase().includes('test')) {
        console.log(`🔍 Processing task ${taskId}: "${subject}"`);
      }
      const hsStatus = (p.hs_task_status || '').trim();
      const hsPriority = (p.hs_task_priority || '').trim();
      const hsType = (p.hs_task_type || '').trim();
      const hubspotOwnerId = (p.hubspot_owner_id || '').trim();
      const hsQueue = (p.hs_task_queue || '').trim();
      const hsReminder = (p.hs_task_reminder || '').trim();
      
      // Debug logging for task type
      if (!hsType || hsType === '') {
        console.warn(`⚠️ Task ${taskId} has no hs_task_type. Properties:`, Object.keys(p));
      }

      // Due date: hs_timestamp is typically epoch millis (but sometimes seconds)
      let dueDate = null;
      const tsRaw = p.hs_timestamp;
      
      // Try to parse timestamp - could be string or number
      let tsNum = NaN;
      if (tsRaw !== undefined && tsRaw !== null && tsRaw !== '') {
        tsNum = Number(tsRaw);
        // If conversion failed, try parsing as date string
        if (isNaN(tsNum) || tsNum <= 0) {
          const parsed = Date.parse(tsRaw);
          if (!isNaN(parsed)) {
            tsNum = parsed;
          }
        } else {
          // Check if timestamp is in seconds (less than year 2000 in millis) or milliseconds
          // If timestamp is less than 946684800000 (Jan 1, 2000), it's likely in seconds
          // Convert seconds to milliseconds if needed
          if (tsNum > 0 && tsNum < 946684800000) {
            tsNum = tsNum * 1000; // Convert seconds to milliseconds
            console.log(`📅 Task ${taskId}: Timestamp was in seconds, converted to milliseconds: ${tsNum}`);
          }
        }
      }
      
      if (!isNaN(tsNum) && tsNum > 0) {
        // Ensure proper Date object with time preserved
        dueDate = new Date(tsNum);
        // Verify time component is preserved
        const hours = dueDate.getHours();
        const minutes = dueDate.getMinutes();
        const seconds = dueDate.getSeconds();
        // Log for debugging with full time info
        console.log(`📅 Task ${taskId}: Due date parsed -> ${dueDate.toISOString()} | Time: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} (${dueDate.toLocaleString('en-GB', { hour12: false })})`);
      } else {
        // fallback to created date if no due date
        const createdRaw = p.hs_createdate;
        const createdMs = createdRaw ? Date.parse(createdRaw) : NaN;
        dueDate = isNaN(createdMs) ? new Date() : new Date(createdMs);
        const hours = dueDate.getHours();
        const minutes = dueDate.getMinutes();
        const seconds = dueDate.getSeconds();
        console.log(`📅 Task ${taskId}: No due date, using created date -> ${dueDate.toISOString()} | Time: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }

      // Map HubSpot priority to our enum
      let priority = 'Medium';
      const pr = hsPriority.toLowerCase();
      if (pr.includes('high')) priority = 'High';
      else if (pr.includes('urgent')) priority = 'Urgent';
      else if (pr.includes('low')) priority = 'Low';

      // Map HubSpot task types to local enum values
      // HubSpot types: TODO, CALL, EMAIL, MEETING, VISIT, etc.
      // Local enum: 'Call', 'Visit', 'Email', 'Quote Follow-up', 'Sample Feedback', 'Order Check'
      // Note: Original HubSpot type is preserved in hs_task_type field
      let type = 'Call'; // Default fallback to valid enum value
      const ty = (hsType || '').toLowerCase().trim();
      if (ty.includes('email')) {
        type = 'Email';
      } else if (ty.includes('visit') || ty.includes('meeting')) {
        type = 'Visit';
      } else if (ty.includes('call')) {
        type = 'Call';
      } else if (ty.includes('quote') || ty.includes('quotation')) {
        type = 'Quote Follow-up';
      } else if (ty.includes('sample')) {
        type = 'Sample Feedback';
      } else if (ty.includes('order')) {
        type = 'Order Check';
      } else if (ty === 'todo' || ty.includes('todo')) {
        // TODO maps to Call as default
        type = 'Call';
      } else {
        // For any unrecognized type, default to Call (valid enum value)
        type = 'Call';
      }
      
      // Debug logging
      if (hsType && hsType !== '') {
        console.log(`📋 Task ${taskId}: hs_task_type="${hsType}" -> display type="${type}"`);
      }

      // Resolve associated contact (if any) -> find customer in DB by email when possible
      let customer = null;
      let customerName = `HubSpot Task ${taskId}`; // Default fallback - required field
      let customerEmail = '';
      let customerPhone = '';
      let associatedContactName = '';

      const contactAssoc = t?.associations?.contacts?.results || [];
      const contactId = contactAssoc.length > 0 ? contactAssoc[0].id : null;
      
      // Debug: Log association info
      console.log(`🔍 Task ${taskId}: Associations check -`, {
        hasAssociations: !!t?.associations,
        contactAssocCount: contactAssoc.length,
        contactId: contactId || 'NONE',
        companyAssocCount: (t?.associations?.companies?.results || []).length,
        allAssociations: Object.keys(t?.associations || {})
      });

      let contactResData = null; // Store contact response for reuse
      let contactCompanyAssoc = []; // Store company associations from contact
      let contactCompany = ''; // Store company name from contact
      
      if (contactId) {
        try {
          // Fetch contact details (email/name/phone) with company associations
          const headers = await (async () => {
            const cfg = require('../../config');
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
          // Fetch contact with company property and associations
          // Add timeout to prevent hanging requests
          const contactRes = await axios.get(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
            { 
              headers, 
              params: { 
                properties: 'firstname,lastname,email,phone,company',
                associations: 'companies' // Also get company associations
              },
              timeout: 10000 // 10 second timeout
            }
          );
          contactResData = contactRes.data; // Store for reuse
          const cp = contactResData?.properties || {};
          customerEmail = (cp.email || '').toLowerCase().trim();
          customerPhone = (cp.phone || '').trim();
          const firstName = (cp.firstname || '').trim();
          const lastName = (cp.lastname || '').trim();
          associatedContactName = `${firstName} ${lastName}`.trim() || customerEmail || '';
          // Set customerName - use contact name, email, or fallback (required field)
          // Ensure customerName is never empty
          if (associatedContactName && associatedContactName.trim()) {
            customerName = associatedContactName.trim();
          } else if (customerEmail && customerEmail.trim()) {
            customerName = customerEmail.trim();
          } else {
            customerName = `HubSpot Task ${taskId}`;
          }
          contactCompany = (cp.company || '').trim();
          
          // Get company associations from contact
          contactCompanyAssoc = contactResData?.associations?.companies?.results || [];
          
          // Debug logging
          console.log(`👤 Task ${taskId}: Contact ${contactId} -> Name: "${associatedContactName}", Email: "${customerEmail}", Company property: "${contactCompany}", Company associations: ${contactCompanyAssoc.length}`);
          
          // If company property is empty, try to get from company associations
          if (!contactCompany && contactCompanyAssoc.length > 0) {
            try {
              const companyId = contactCompanyAssoc[0].id;
              const companyRes = await axios.get(
                `https://api.hubapi.com/crm/v3/objects/companies/${companyId}`,
                { headers, params: { properties: 'name' }, timeout: 10000 }
              );
              contactCompany = (companyRes.data?.properties?.name || '').trim();
              console.log(`🏢 Task ${taskId}: Got company from contact association: "${contactCompany}"`);
            } catch (e) {
              console.warn(`Failed to fetch company name from contact association:`, e.message);
            }
          }
          
          if (customerEmail) {
            customer = await Customer.findOne({ email: customerEmail });
            // If customer exists but doesn't have company, update it from HubSpot
            if (customer && contactCompany && (!customer.company || customer.company.trim() === '')) {
              customer.company = contactCompany;
              await customer.save();
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch contact ${contactId} for task ${taskId}:`, e.message);
        }
      }

      // Get company information - prioritize from contact associations, then from task associations
      let associatedCompanyId = null;
      let associatedCompanyName = '';
      let associatedCompanyDomain = '';
      
      // Get headers for API calls
      const headers = await (async () => {
        const cfg = require('../../config');
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
      
      try {
        // Priority 1: Get company from contact's company associations (most reliable)
        if (contactId && contactResData && contactCompanyAssoc.length > 0) {
          associatedCompanyId = contactCompanyAssoc[0].id;
          try {
            const companyRes = await axios.get(
              `https://api.hubapi.com/crm/v3/objects/companies/${associatedCompanyId}`,
              { headers, params: { properties: 'name,domain' }, timeout: 10000 }
            );
            const cp = companyRes.data?.properties || {};
            associatedCompanyName = (cp.name || '').trim();
            associatedCompanyDomain = (cp.domain || '').trim();
            console.log(`🏢 Task ${taskId}: Company from contact association -> ID: ${associatedCompanyId}, Name: "${associatedCompanyName}"`);
          } catch (e) {
            console.warn(`Failed to fetch company details for ID ${associatedCompanyId}:`, e.message);
          }
        }
        
        // Priority 2: If no company from contact associations, try contact's company property
        if (!associatedCompanyName && contactCompany && contactCompany.trim()) {
          associatedCompanyName = contactCompany.trim();
          console.log(`🏢 Task ${taskId}: Using company from contact property: "${associatedCompanyName}"`);
        }
        
        // Priority 3: Try task's direct company associations (works even if contact not found)
        if (!associatedCompanyId) {
          const taskCompanyAssoc = t?.associations?.companies?.results || [];
          if (taskCompanyAssoc.length > 0) {
            associatedCompanyId = taskCompanyAssoc[0].id;
            try {
              const companyRes = await axios.get(
                `https://api.hubapi.com/crm/v3/objects/companies/${associatedCompanyId}`,
                { headers, params: { properties: 'name,domain' }, timeout: 10000 }
              );
              const cp = companyRes.data?.properties || {};
              associatedCompanyName = (cp.name || '').trim();
              associatedCompanyDomain = (cp.domain || '').trim();
              console.log(`🏢 Task ${taskId}: Company from task association -> ID: ${associatedCompanyId}, Name: "${associatedCompanyName}"`);
            } catch (e) {
              console.warn(`Failed to fetch company from task association for ID ${associatedCompanyId}:`, e.message);
            }
          }
        }
        
        // Priority 4: Fallback to contactCompany if still no company found
        if (!associatedCompanyName && contactCompany && contactCompany.trim()) {
          associatedCompanyName = contactCompany.trim();
          console.log(`🏢 Task ${taskId}: Using company from contact property (fallback): "${associatedCompanyName}"`);
        }
      } catch (e) {
        console.warn(`Error fetching company information for task ${taskId}:`, e.message);
        // Final fallback to contactCompany if available
        if (!associatedCompanyName && contactCompany && contactCompany.trim()) {
          associatedCompanyName = contactCompany.trim();
        }
      }
      
      // Debug logging for final values
      console.log(`✅ Task ${taskId} import summary:`, {
        contactName: associatedContactName || 'N/A',
        contactId: contactId || 'N/A',
        companyName: associatedCompanyName || 'N/A',
        companyId: associatedCompanyId || 'N/A',
        taskType: hsType || 'N/A',
        displayType: type
      });
      
      // If no contact found, log warning
      if (!contactId) {
        console.warn(`⚠️ Task ${taskId} has no contact association. Task associations:`, JSON.stringify(t?.associations || {}, null, 2));
      }

      // Parse HubSpot dates
      let hsCreatedDate = null;
      let hsLastModifiedDate = null;
      if (p.hs_createdate) {
        const createdMs = Date.parse(p.hs_createdate);
        if (!isNaN(createdMs)) hsCreatedDate = new Date(createdMs);
      }
      if (p.hs_lastmodifieddate) {
        const modifiedMs = Date.parse(p.hs_lastmodifieddate);
        if (!isNaN(modifiedMs)) hsLastModifiedDate = new Date(modifiedMs);
      }

      // Simple logic: Match HubSpot "Assigned to" with local users (admin or salesman)
      // HubSpot assigned users → local salesman (or admin if admin matches)
      let assignedSalesman = null;
      let hubspotOwnerName = '';
      let hubspotOwnerEmail = '';
      
      if (hubspotOwnerId) {
        try {
          // Get assigned user details from HubSpot
          const ownerDetails = await hubspotService.getOwnerById(hubspotOwnerId);
          if (ownerDetails) {
            hubspotOwnerName = ownerDetails.fullName || '';
            hubspotOwnerEmail = ownerDetails.email || '';
            console.log(`👤 Task ${taskId}: HubSpot assigned -> "${hubspotOwnerName}" (${hubspotOwnerEmail})`);
            
            // Simple matching: Try exact email match first, then name match
            if (hubspotOwnerEmail) {
              const searchEmail = hubspotOwnerEmail.toLowerCase().trim();
              
              // Step 1: Exact email match (case-insensitive)
              let matchingUser = await User.findOne({ 
                email: { $regex: new RegExp(`^${searchEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                role: { $in: ['admin', 'salesman'] }
              });
              
              // Step 2: If not found, try name match (case-insensitive)
              if (!matchingUser && hubspotOwnerName) {
                const searchName = hubspotOwnerName.toLowerCase().trim();
                matchingUser = await User.findOne({
                  name: { $regex: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                  role: { $in: ['admin', 'salesman'] }
                });
              }
              
              // If match found, assign it
              if (matchingUser) {
                assignedSalesman = matchingUser._id;
                console.log(`✅ Task ${taskId}: Matched "${hubspotOwnerName}" → ${matchingUser.name || matchingUser.email} (${matchingUser.role})`);
              } else {
                // No match - use current user (admin) as fallback
                assignedSalesman = req.user?._id;
                console.log(`ℹ️ Task ${taskId}: No match for "${hubspotOwnerName}". Using current user (${req.user?.name || req.user?.email}) as salesman.`);
              }
            } else {
              // No email - use current user as fallback
              assignedSalesman = req.user?._id;
              console.log(`ℹ️ Task ${taskId}: HubSpot assigned user has no email. Using current user as salesman.`);
            }
          } else {
            // Could not fetch owner details - use current user as fallback
            assignedSalesman = req.user?._id;
            console.log(`ℹ️ Task ${taskId}: Could not fetch HubSpot owner details. Using current user as salesman.`);
          }
        } catch (e) {
          // Error fetching owner - use current user as fallback
          console.warn(`Task ${taskId}: Error fetching HubSpot owner:`, e.message);
          assignedSalesman = req.user?._id;
        }
      } else {
        // No hubspot_owner_id - use current user as fallback
        assignedSalesman = req.user?._id;
        console.log(`ℹ️ Task ${taskId}: No HubSpot assigned user. Using current user as salesman.`);
      }
      
      // Ensure assignedSalesman is never null (required field)
      if (!assignedSalesman) {
        assignedSalesman = req.user?._id;
      }

      // Upsert follow-up by hubspotTaskId
      const existing = await FollowUp.findOne({ hubspotTaskId: taskId });

      const payload = {
        hubspotTaskId: taskId,
        // HubSpot original properties
        hs_createdate: hsCreatedDate,
        hs_lastmodifieddate: hsLastModifiedDate,
        hs_task_subject: subject,
        hs_task_body: body,
        hs_task_status: hsStatus,
        hs_task_priority: hsPriority,
        hs_task_type: hsType,
        hs_timestamp: dueDate,
        hubspot_owner_id: hubspotOwnerId || null,
        hubspot_owner_name: hubspotOwnerName || null,
        hubspot_owner_email: hubspotOwnerEmail || null,
        hs_task_queue: hsQueue || null,
        hs_task_reminder: hsReminder || null,
        // Core task fields
        // salesman is required field, so always set it (use current user if no match found)
        // Frontend will prioritize hubspot_owner_name for display
        salesman: assignedSalesman, // Always set (required field) - frontend will show hubspot_owner_name if available
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
        // Associated entities (HubSpot-style)
        associatedContactId: contactId || null,
        associatedContactName: associatedContactName || '',
        associatedContactEmail: customerEmail || null,
        associatedCompanyId: associatedCompanyId || null,
        associatedCompanyName: associatedCompanyName || '',
        associatedCompanyDomain: associatedCompanyDomain || '',
        // Metadata
        source: 'hubspot',
        createdBy: req.user?._id,
        approvalStatus: 'Approved', // Imported tasks from HubSpot are auto-approved
        hubspotLastSyncedAt: new Date(),
      };

      // If completed, mark completed; otherwise pre-save hook will compute Overdue/Today/Upcoming
      if (hsStatus.toLowerCase().includes('complete')) {
        payload.status = 'Completed';
        payload.completedDate = new Date();
      }

      if (existing) {
        // Update all HubSpot fields
        existing.hubspotTaskId = payload.hubspotTaskId;
        existing.hs_createdate = payload.hs_createdate || existing.hs_createdate;
        existing.hs_lastmodifieddate = payload.hs_lastmodifieddate || existing.hs_lastmodifieddate;
        existing.hs_task_subject = payload.hs_task_subject || existing.hs_task_subject;
        existing.hs_task_body = payload.hs_task_body || existing.hs_task_body;
        existing.hs_task_status = payload.hs_task_status || existing.hs_task_status;
        existing.hs_task_priority = payload.hs_task_priority || existing.hs_task_priority;
        existing.hs_task_type = payload.hs_task_type || existing.hs_task_type;
        existing.hs_timestamp = payload.hs_timestamp || existing.hs_timestamp;
        if (payload.hubspot_owner_id !== undefined) existing.hubspot_owner_id = payload.hubspot_owner_id;
        if (payload.hubspot_owner_name !== undefined) existing.hubspot_owner_name = payload.hubspot_owner_name;
        if (payload.hubspot_owner_email !== undefined) existing.hubspot_owner_email = payload.hubspot_owner_email;
        if (payload.hs_task_queue !== undefined) existing.hs_task_queue = payload.hs_task_queue;
        if (payload.hs_task_reminder !== undefined) existing.hs_task_reminder = payload.hs_task_reminder;
        // Update core fields
        // salesman is required field, so always update it
        // Frontend will prioritize hubspot_owner_name for display
        existing.salesman = payload.salesman || existing.salesman;
        existing.customer = payload.customer ?? existing.customer;
        // Ensure customerName is never empty (required field)
        existing.customerName = (payload.customerName && payload.customerName.trim()) ? payload.customerName.trim() : (existing.customerName || `HubSpot Task ${taskId}`);
        existing.customerEmail = payload.customerEmail || existing.customerEmail;
        existing.customerPhone = payload.customerPhone || existing.customerPhone;
        existing.type = payload.type || existing.type;
        existing.priority = payload.priority || existing.priority;
        existing.scheduledDate = payload.scheduledDate || existing.scheduledDate;
        existing.dueDate = payload.dueDate || existing.dueDate;
        existing.description = payload.description || existing.description;
        existing.notes = payload.notes || existing.notes;
        // Update associated entities - always update if payload has values
        if (payload.associatedContactId !== undefined) existing.associatedContactId = payload.associatedContactId;
        if (payload.associatedContactName !== undefined && payload.associatedContactName.trim()) existing.associatedContactName = payload.associatedContactName.trim();
        if (payload.associatedContactEmail !== undefined) existing.associatedContactEmail = payload.associatedContactEmail;
        if (payload.associatedCompanyId !== undefined) existing.associatedCompanyId = payload.associatedCompanyId;
        if (payload.associatedCompanyName !== undefined && payload.associatedCompanyName.trim()) existing.associatedCompanyName = payload.associatedCompanyName.trim();
        if (payload.associatedCompanyDomain !== undefined && payload.associatedCompanyDomain.trim()) existing.associatedCompanyDomain = payload.associatedCompanyDomain.trim();
        // Update metadata - IMPORTANT: Only set source to 'hubspot' if it's actually imported (not app-created)
        // Don't overwrite 'app' source if task was created in app
        if (payload.source === 'hubspot' && (!existing.source || existing.source === 'hubspot')) {
          existing.source = 'hubspot';
        } else if (!existing.source) {
          // If no source set, mark as hubspot (imported)
          existing.source = 'hubspot';
        }
        // If existing.source is 'app', keep it as 'app' (don't overwrite)
        existing.approvalStatus = 'Approved'; // Ensure imported tasks are approved
        existing.hubspotLastSyncedAt = payload.hubspotLastSyncedAt;
        if (payload.status) existing.status = payload.status;
        if (payload.completedDate) existing.completedDate = payload.completedDate;
        await existing.save();
        updated += 1;
        console.log(`✅ Task ${taskId}: Updated successfully`);
      } else {
        try {
          await FollowUp.create(payload);
          created += 1;
          console.log(`✅ Task ${taskId}: Created successfully - "${subject || 'No subject'}"`);
        } catch (createError) {
          skipped += 1;
          console.error(`❌ Task ${taskId}: Failed to create -`, createError.message);
          console.error(`   Error details:`, {
            subject: subject || 'N/A',
            customerName: customerName || 'N/A',
            salesman: assignedSalesman ? 'Set' : 'Missing',
            dueDate: dueDate ? dueDate.toISOString() : 'N/A',
            type: type || 'N/A',
            validationErrors: createError.errors || 'N/A'
          });
          continue;
        }
      }
    }

    console.log(`\n📊 Import Summary:`);
    const filterDescription = currentMonthOnly 
      ? (weekWise ? ' (current month: previous week, current week, next week)' : ' (current month only)')
      : '';
    console.log(`   Fetched from HubSpot: ${hubspotTasks.length} tasks${filterDescription}`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total processed: ${created + updated + skipped}`);
    
    // Log all task subjects for debugging (especially for missing tasks like "test4" or 30 Jan tasks)
    if (hubspotTasks.length > 0) {
      console.log(`\n📋 All Tasks fetched from HubSpot (${hubspotTasks.length} total):`);
      hubspotTasks.forEach((t, idx) => {
        const subj = (t?.properties?.hs_task_subject || '').trim() || 'No subject';
        const taskId = String(t?.id || '').trim() || 'No ID';
        const tsRaw = t?.properties?.hs_timestamp;
        let dueDateStr = 'N/A';
        if (tsRaw) {
          let tsNum = Number(tsRaw);
          // Check if in seconds and convert
          if (tsNum > 0 && tsNum < 946684800000) {
            tsNum = tsNum * 1000;
          }
          if (!isNaN(tsNum) && tsNum > 0) {
            const dueDate = new Date(tsNum);
            dueDateStr = `${dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${dueDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
          }
        }
        console.log(`   ${idx + 1}. Task ${taskId}: "${subj}" (Due: ${dueDateStr})`);
      });
      
      // Check specifically for 30 Jan tasks
      const jan30Tasks = hubspotTasks.filter(t => {
        const tsRaw = t?.properties?.hs_timestamp;
        if (!tsRaw) return false;
        let tsNum = Number(tsRaw);
        if (tsNum > 0 && tsNum < 946684800000) {
          tsNum = tsNum * 1000;
        }
        if (isNaN(tsNum) || tsNum <= 0) return false;
        const dueDate = new Date(tsNum);
        return dueDate.getDate() === 30 && dueDate.getMonth() === 0; // 30 Jan (month 0 = January)
      });
      
      if (jan30Tasks.length > 0) {
        console.log(`\n✅ Found ${jan30Tasks.length} task(s) for 30 Jan:`);
        jan30Tasks.forEach((t, idx) => {
          const subj = (t?.properties?.hs_task_subject || '').trim() || 'No subject';
          const taskId = String(t?.id || '').trim() || 'No ID';
          const tsRaw = t?.properties?.hs_timestamp;
          let timeStr = '';
          if (tsRaw) {
            let tsNum = Number(tsRaw);
            if (tsNum > 0 && tsNum < 946684800000) {
              tsNum = tsNum * 1000;
            }
            if (!isNaN(tsNum) && tsNum > 0) {
              const dueDate = new Date(tsNum);
              timeStr = ` (${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')})`;
            }
          }
          console.log(`   ${idx + 1}. Task ${taskId}: "${subj}"${timeStr}`);
        });
        
        // Specifically check for 13:00 tasks
        const jan30_13_00_tasks = jan30Tasks.filter(t => {
          const tsRaw = t?.properties?.hs_timestamp;
          if (!tsRaw) return false;
          let tsNum = Number(tsRaw);
          if (tsNum > 0 && tsNum < 946684800000) {
            tsNum = tsNum * 1000;
          }
          if (isNaN(tsNum) || tsNum <= 0) return false;
          const dueDate = new Date(tsNum);
          return dueDate.getHours() === 13 && dueDate.getMinutes() === 0;
        });
        
        if (jan30_13_00_tasks.length > 0) {
          console.log(`\n   📌 Specifically, ${jan30_13_00_tasks.length} task(s) with time 13:00:`);
          jan30_13_00_tasks.forEach((t, idx) => {
            const subj = (t?.properties?.hs_task_subject || '').trim() || 'No subject';
            const taskId = String(t?.id || '').trim() || 'No ID';
            console.log(`      ${idx + 1}. Task ${taskId}: "${subj}"`);
          });
        }
      } else {
        console.log(`\n⚠️ No tasks found for 30 Jan in fetched results. This might indicate a date filtering issue.`);
        console.log(`   Check if the date range includes 30 Jan and if there are more than ${limit} tasks in the range.`);
      }
    }
    console.log(`\n✅ Imported Fields:`);
    console.log(`   - Task Type (hs_task_type): ✅`);
    console.log(`   - Priority: ✅`);
    console.log(`   - Assigned Owner/Salesman: ✅`);
    console.log(`   - Associated Contact: ✅`);
    console.log(`   - Associated Company: ✅`);
    console.log(`   - Queue: ✅`);
    console.log(`   - Reminder: ✅`);
    console.log(`   - Due Date (with time): ✅`);
    console.log(`   - Notes: ✅`);
    console.log(`   - Filter: ${currentMonthOnly ? (weekWise ? '✅ Current Month Weeks (Previous, Current, Next)' : '✅ Current Month Only') : '❌ All Tasks'}\n`);

    return res.status(200).json({
      success: true,
      message: `HubSpot tasks imported to Follow-Ups successfully${currentMonthOnly ? (weekWise ? ' (current month: previous week, current week, next week)' : ' (current month only)') : ''}`,
      data: {
        fetchedFromHubSpot: hubspotTasks.length,
        created,
        updated,
        skipped,
        totalProcessed: created + updated + skipped,
        currentMonthOnly,
        weekWise,
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
    const config = require('../../config');
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
// Body params: force (boolean), limit (number), myContactsOnly (boolean), customerIds (array) - If customerIds provided, only push those specific customers
const pushCustomersToHubSpot = async (req, res) => {
  try {
    const force = Boolean(req.body?.force || false);
    const limit = Number(req.body?.limit || 0);
    const myContactsOnly = req.body?.myContactsOnly === true || req.body?.myContactsOnly === 'true';
    const customerIds = Array.isArray(req.body?.customerIds) ? req.body.customerIds : null;
    console.log('Pushing customers to HubSpot (My Contacts Only:', myContactsOnly, ', Customer IDs:', customerIds, ')');

    let query = {};
    if (customerIds && customerIds.length > 0) {
      // Push only specific customers
      query = { _id: { $in: customerIds } };
    }

    let q = Customer.find(query).sort({ updatedAt: -1 });
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
        // If myContactsOnly is true, assign contact to current user
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
        }, {
          assignToMe: myContactsOnly, // Assign to current user if myContactsOnly is true
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
        myContactsOnly,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error pushing customers to HubSpot',
    });
  }
};

// @desc    Push existing approved Tasks (Follow-ups) to HubSpot
// @route   POST /api/admin/hubspot/push-tasks
// @access  Private/Admin
// Body: { force?: boolean, limit?: number }
const pushTasksToHubSpot = async (req, res) => {
  try {
    const force = Boolean(req.body?.force || false);
    const limit = Number(req.body?.limit || 0);

    // Only push approved tasks that don't have hubspotTaskId yet
    const query = force
      ? { approvalStatus: 'Approved' }
      : {
          approvalStatus: 'Approved',
          $or: [
            { hubspotTaskId: { $exists: false } },
            { hubspotTaskId: '' },
            { hubspotTaskId: null },
          ],
        };

    let q = FollowUp.find(query).sort({ createdAt: -1 });
    if (limit && !Number.isNaN(limit)) q = q.limit(limit);
    const tasks = await q;

    let attempted = 0;
    let synced = 0;
    let skipped = 0;
    const failures = [];

    for (const task of tasks) {
      attempted += 1;
      try {
        // Skip if already has hubspotTaskId (unless force)
        if (task.hubspotTaskId && !force) {
          skipped += 1;
          continue;
        }

        const subject = task.description || `Follow-up: ${task.customerName}`;
        const body = task.notes || '';

        // Map local priority to HubSpot priority values
        let hsPriority = 'NONE';
        const pr = (task.priority || '').toLowerCase();
        if (pr === 'urgent' || pr === 'high') hsPriority = 'HIGH';
        else if (pr === 'medium') hsPriority = 'MEDIUM';
        else if (pr === 'low') hsPriority = 'LOW';

        const hubspotTaskId = await hubspotService.createTaskObjectInHubSpot({
          subject,
          body,
          status: 'NOT_STARTED',
          priority: hsPriority,
          type: 'TODO',
          dueDate: task.dueDate,
        });

        if (hubspotTaskId) {
          task.hubspotTaskId = hubspotTaskId;
          await task.save();
          synced += 1;
        } else {
          failures.push({
            taskId: task._id,
            followUpNumber: task.followUpNumber,
            message: 'HubSpot task creation returned null',
          });
        }
      } catch (e) {
        const msg = e.response?.data?.message || e.message || 'Unknown error';
        failures.push({
          taskId: task._id,
          followUpNumber: task.followUpNumber,
          message: msg,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Task push completed: ${synced} synced, ${skipped} skipped, ${failures.length} failed`,
      data: {
        attempted,
        synced,
        skipped,
        failed: failures.length,
        failures: failures.slice(0, 10), // Limit failures in response
      },
    });
  } catch (error) {
    console.error('Error pushing tasks to HubSpot:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error pushing tasks to HubSpot',
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
  pushTasksToHubSpot,
  repairOrderAssociations,
};
