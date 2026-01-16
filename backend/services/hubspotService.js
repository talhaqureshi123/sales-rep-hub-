/**
 * HubSpot Integration Service
 * Handles all HubSpot API operations for syncing data
 */

const axios = require("axios");
const config = require("../config");
const hubspotOAuthService = require("./hubspotOAuthService");

// HubSpot API Base URL
const HUBSPOT_API_BASE = "https://api.hubapi.com";

const normalizeToken = (value) => {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/^[\"']|[\"']$/g, "")
    .replace(/[\r\n]+/g, "");
};

const stripEmptyValues = (obj = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
};

const isValidEmail = (email) => {
  if (!email) return false;
  const s = String(email).trim();
  // Simple sanity check; we mainly want to avoid sending "" / garbage to HubSpot
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
};

// Cache associationTypeIds so we don't fetch labels repeatedly
const associationTypeIdCache = new Map();
// Cache object properties so we don't fetch repeatedly
const objectPropertiesCache = new Map();

// HubSpot objectTypeIds (as used in UI and some v4 endpoints)
// We only map what we need right now.
const HUBSPOT_OBJECT_TYPE_IDS = {
  contacts: "0-1",
  companies: "0-2",
  deals: "0-3",
  tickets: "0-5",
  tasks: "0-27",
  orders: "0-123",
};

const normalizeObjectTypeForV4 = (objectType) => {
  if (!objectType) return objectType;
  const s = String(objectType);
  // If already looks like an objectTypeId (e.g. 0-1, 0-123), keep it
  if (/^\d+-\d+$/.test(s)) return s;
  const key = s.toLowerCase();
  return HUBSPOT_OBJECT_TYPE_IDS[key] || s;
};

const getAssociationTypeId = async (fromType, toType) => {
  const from = normalizeObjectTypeForV4(fromType);
  const to = normalizeObjectTypeForV4(toType);
  const key = `${from}->${to}`;
  if (associationTypeIdCache.has(key)) return associationTypeIdCache.get(key);

  const headers = await getHeaders();
  if (!headers) return null;

  try {
    // HubSpot v4: get association labels (contains associationTypeId)
    const res = await axios.get(
      `${HUBSPOT_API_BASE}/crm/v4/associations/${from}/${to}/labels`,
      {
        headers,
      }
    );

    const results = res.data?.results || [];
    const typeId = results[0]?.typeId || null;
    associationTypeIdCache.set(key, typeId);
    return typeId;
  } catch (e) {
    console.error(
      `Error getting association labels for ${fromType}->${toType}:`,
      e.response?.data || e.message
    );
    associationTypeIdCache.set(key, null);
    return null;
  }
};

const associateObjects = async (fromType, fromId, toType, toId) => {
  const headers = await getHeaders();
  if (!headers) return false;
  if (!fromId || !toId) return false;

  const from = normalizeObjectTypeForV4(fromType);
  const to = normalizeObjectTypeForV4(toType);

  const typeId = await getAssociationTypeId(from, to);
  if (!typeId) {
    console.warn(
      `No associationTypeId found for ${fromType}->${toType}. Skipping association.`
    );
    return false;
  }

  try {
    await axios.put(
      `${HUBSPOT_API_BASE}/crm/v4/objects/${from}/${fromId}/associations/${to}/${toId}/${typeId}`,
      {},
      { headers }
    );
    return true;
  } catch (e) {
    console.error(
      `Error associating ${fromType}:${fromId} -> ${toType}:${toId}:`,
      e.response?.data || e.message
    );
    return false;
  }
};

const associateOrderToContact = async (orderId, contactId) => {
  return associateObjects("orders", orderId, "contacts", contactId);
};

const getObjectProperties = async (objectType) => {
  if (objectPropertiesCache.has(objectType))
    return objectPropertiesCache.get(objectType);
  const headers = await getHeaders();
  if (!headers) return [];
  try {
    const res = await axios.get(
      `${HUBSPOT_API_BASE}/crm/v3/properties/${objectType}`,
      { headers }
    );
    const props = res.data?.results || [];
    objectPropertiesCache.set(objectType, props);
    return props;
  } catch (e) {
    console.error(
      `Error fetching HubSpot properties for ${objectType}:`,
      e.response?.data || e.message
    );
    objectPropertiesCache.set(objectType, []);
    return [];
  }
};

const buildRequiredPropertiesPayload = async (objectType, provided = {}) => {
  const props = await getObjectProperties(objectType);
  const payload = { ...(provided || {}) };

  const bestName =
    payload.hs_order_name ||
    payload.order_name ||
    payload.dealname ||
    payload.name ||
    payload.hs_task_subject ||
    payload.subject ||
    "N/A";

  const requiredProps = props.filter(
    (p) => p?.required && !p?.readOnly && p?.name
  );
  const allowedNames = new Set(props.map((p) => p?.name).filter(Boolean));

  // Drop unknown properties to avoid PROPERTY_DOESNT_EXIST errors
  for (const key of Object.keys(payload)) {
    if (!allowedNames.has(key)) {
      delete payload[key];
    }
  }

  for (const p of requiredProps) {
    const name = p.name;
    const existing = payload[name];
    if (existing !== undefined && existing !== null && String(existing) !== "")
      continue;

    const type = String(p.type || "").toLowerCase();
    if (type.includes("enumeration")) {
      const first = p.options?.[0]?.value;
      if (first !== undefined) payload[name] = first;
      continue;
    }
    if (type.includes("number")) {
      payload[name] = "0";
      continue;
    }
    if (type.includes("date") || type.includes("datetime")) {
      payload[name] = String(Date.now());
      continue;
    }
    // Required string-like fields usually must be non-empty
    payload[name] = String(bestName);
  }

  return payload;
};

const filterToKnownProperties = async (objectType, provided = {}) => {
  const props = await getObjectProperties(objectType);
  const allowedNames = new Set(props.map((p) => p?.name).filter(Boolean));
  const filtered = {};
  for (const [k, v] of Object.entries(provided || {})) {
    if (allowedNames.has(k)) filtered[k] = v;
  }
  return filtered;
};

/**
 * Get HubSpot API headers
 * Supports:
 * - Token mode (Private App token): HUBSPOT_TOKEN / HUBSPOT_ACCESS_TOKEN / HUBSPOT_API_KEY
 * - OAuth mode: access_token stored in DB and auto-refreshed (HUBSPOT_AUTH_MODE=oauth)
 */
const getHeaders = async () => {
  let accessToken = "";

  if (config.HUBSPOT_AUTH_MODE === "oauth") {
    try {
      accessToken = await hubspotOAuthService.getValidAccessToken();
    } catch (e) {
      console.warn(`HubSpot OAuth token not available: ${e.message}`);
      accessToken = "";
    }
  } else {
    accessToken = normalizeToken(
      config.HUBSPOT_TOKEN ||
        config.HUBSPOT_ACCESS_TOKEN ||
        config.HUBSPOT_API_KEY
    );
  }

  if (!accessToken) {
    console.warn("HubSpot access token not configured. Integration disabled.");
    return null;
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
};

/**
 * Create or update contact in HubSpot
 * @param {Object} customerData - Customer data from our system
 * @returns {Object} HubSpot contact object or null if failed
 */
const createOrUpdateContact = async (customerData) => {
  try {
    const headers = await getHeaders();
    if (!headers) return null;

    const firstName =
      customerData.name?.split(" ")[0] || customerData.name || "";
    const lastName = customerData.name?.split(" ").slice(1).join(" ") || "";

    const contactProperties = stripEmptyValues({
      ...(isValidEmail(customerData.email)
        ? { email: String(customerData.email).trim() }
        : {}),
      firstname: firstName,
      ...(lastName ? { lastname: lastName } : {}),
      phone: customerData.phone,
      company: customerData.company,
      address: customerData.address,
      city: customerData.city,
      state: customerData.state,
      zip: customerData.pincode,
      // hs_lead_status has strict allowed options per portal; set only when safe
      ...(customerData.status === "Active" ? { hs_lead_status: "NEW" } : {}),
      // Avoid pushing unknown properties (some portals don't have "notes" on contacts)
      notes: customerData.notes,
    });

    const safeContactProperties = await filterToKnownProperties(
      "contacts",
      contactProperties
    );

    // Try to find existing contact by email
    let contactId = null;
    if (isValidEmail(customerData.email)) {
      try {
        // Search by email using filter
        const searchResponse = await axios.post(
          `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
          {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: "email",
                    operator: "EQ",
                    value: String(customerData.email).trim(),
                  },
                ],
              },
            ],
            limit: 1,
          },
          { headers }
        );
        if (searchResponse.data?.results?.length > 0) {
          contactId = searchResponse.data.results[0].id;
        }
      } catch (error) {
        // Contact not found, will create new
        console.log(
          "Contact not found, creating new:",
          error.response?.data?.message || error.message
        );
      }
    }

    // Create or update contact
    if (contactId) {
      // Update existing contact
      const response = await axios.patch(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`,
        { properties: safeContactProperties },
        { headers }
      );
      console.log("HubSpot contact updated:", response.data.id);
      return response.data;
    } else {
      // Create new contact
      const response = await axios.post(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
        { properties: safeContactProperties },
        { headers }
      );
      console.log("HubSpot contact created:", response.data.id);
      return response.data;
    }
  } catch (error) {
    console.error(
      "Error syncing contact to HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Create deal in HubSpot
 * @param {Object} quotationData - Quotation data from our system
 * @param {String} contactId - HubSpot contact ID (optional)
 * @returns {Object} HubSpot deal object or null if failed
 */
const createDeal = async (quotationData, contactId = null) => {
  try {
    const headers = await getHeaders();
    if (!headers) return null;

    // Deals often have portal-specific required properties/stages/pipelines.
    // We build a safe payload by:
    // - filtering unknown properties
    // - auto-filling required fields with first valid option / defaults
    const provided = {
      dealname: `Quotation ${quotationData.quotationNumber}`,
      amount: quotationData.total?.toString() || "0",
      closedate: new Date().toISOString(),
      description: quotationData.notes || "",
      // Intentionally NOT forcing dealstage/pipeline here; required fields are auto-filled below
    };

    const dealProperties = await buildRequiredPropertiesPayload(
      "deals",
      provided
    );

    // Create deal
    const response = await axios.post(
      `${HUBSPOT_API_BASE}/crm/v3/objects/deals`,
      { properties: dealProperties },
      { headers }
    );

    const dealId = response.data.id;
    console.log("HubSpot deal created:", dealId);

    // Associate deal with contact if contactId provided
    if (contactId && dealId) {
      try {
        const ok = await associateObjects(
          "deals",
          dealId,
          "contacts",
          contactId
        );
        if (ok) console.log("Deal associated with contact");
      } catch (error) {
        console.error("Error associating deal with contact:", error.message);
      }
    }

    // If quotation has items, create line items and associate to deal
    const items = Array.isArray(quotationData?.items)
      ? quotationData.items
      : [];
    if (dealId && items.length > 0) {
      for (const item of items) {
        try {
          const lineItemProvided = {
            name: item.productName || item.name || "Line item",
            quantity: String(item.quantity ?? 1),
            price: String(item.price ?? 0),
          };

          const lineItemProps = await buildRequiredPropertiesPayload(
            "line_items",
            lineItemProvided
          );
          const liRes = await axios.post(
            `${HUBSPOT_API_BASE}/crm/v3/objects/line_items`,
            { properties: lineItemProps },
            { headers }
          );

          const lineItemId = liRes.data?.id;
          if (lineItemId) {
            const ok = await associateObjects(
              "deals",
              dealId,
              "line_items",
              lineItemId
            );
            if (ok) console.log("Line item associated with deal:", lineItemId);
          }
        } catch (e) {
          console.error(
            "Error creating/associating line item in HubSpot:",
            e.response?.data || e.message
          );
        }
      }
    }

    return response.data;
  } catch (error) {
    console.error(
      "Error creating deal in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Create timeline event (activity/note) in HubSpot
 * @param {String} contactId - HubSpot contact ID
 * @param {String} eventType - Type of event (NOTE, MEETING, CALL, etc.)
 * @param {String} subject - Event subject
 * @param {String} body - Event body/notes
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Timeline event or null if failed
 */
const createTimelineEvent = async (
  contactId,
  eventType,
  subject,
  body,
  metadata = {}
) => {
  try {
    const headers = await getHeaders();
    if (!headers || !contactId) return null;

    // Use engagements API for notes
    const engagementData = {
      engagement: {
        type: eventType === "NOTE" ? "NOTE" : "MEETING",
        active: true,
      },
      associations: {
        contactIds: [contactId],
      },
      metadata: {
        body: `${subject}\n\n${body}`,
        ...metadata,
      },
    };

    const response = await axios.post(
      `${HUBSPOT_API_BASE}/engagements/v1/engagements`,
      engagementData,
      { headers }
    );

    console.log("HubSpot timeline event created");
    return response.data;
  } catch (error) {
    console.error(
      "Error creating timeline event in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Create note in HubSpot
 * @param {String} contactId - HubSpot contact ID
 * @param {String} note - Note content
 * @param {String} noteType - Type of note (VISIT_COMPLETED, ACHIEVEMENT, etc.)
 * @returns {Object} Note object or null if failed
 */
const createNote = async (contactId, note, noteType = "GENERAL") => {
  try {
    const headers = await getHeaders();
    if (!headers || !contactId) return null;

    const noteData = {
      engagement: {
        type: "NOTE",
        active: true,
      },
      associations: {
        contactIds: [contactId],
      },
      metadata: {
        body: note,
        noteType: noteType,
      },
    };

    const response = await axios.post(
      `${HUBSPOT_API_BASE}/engagements/v1/engagements`,
      noteData,
      { headers }
    );

    console.log("HubSpot note created");
    return response.data;
  } catch (error) {
    console.error(
      "Error creating note in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Update contact property in HubSpot
 * @param {String} contactId - HubSpot contact ID
 * @param {String} property - Property name
 * @param {String} value - Property value
 * @returns {Boolean} Success status
 */
const updateContactProperty = async (contactId, property, value) => {
  try {
    const headers = await getHeaders();
    if (!headers || !contactId) return false;

    await axios.patch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`,
      { properties: { [property]: value } },
      { headers }
    );

    console.log(`HubSpot contact property updated: ${property}`);
    return true;
  } catch (error) {
    console.error(
      "Error updating contact property in HubSpot:",
      error.response?.data || error.message
    );
    return false;
  }
};

/**
 * Search for contact by email in HubSpot
 * @param {String} email - Contact email
 * @returns {String|null} HubSpot contact ID or null
 */
const findContactByEmail = async (email) => {
  try {
    const headers = await getHeaders();
    if (!headers || !email) return null;

    // Search by email using filter
    const response = await axios.post(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: email,
              },
            ],
          },
        ],
        limit: 1,
      },
      { headers }
    );

    if (response.data?.results?.length > 0) {
      return response.data.results[0].id;
    }
    return null;
  } catch (error) {
    console.error(
      "Error searching contact in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Create task in HubSpot
 * @param {String} contactId - HubSpot contact ID
 * @param {String} taskTitle - Task title
 * @param {String} taskBody - Task description/body
 * @param {Date} dueDate - Task due date
 * @param {String} taskType - Task type (CALL, EMAIL, TODO, etc.)
 * @returns {Object} Task object or null if failed
 */
const createTask = async (
  contactId,
  taskTitle,
  taskBody,
  dueDate = null,
  taskType = "TODO"
) => {
  try {
    const headers = await getHeaders();
    if (!headers || !contactId) return null;

    const taskData = {
      engagement: {
        type: "TASK",
        active: true,
      },
      associations: {
        contactIds: [contactId],
      },
      metadata: {
        body: taskBody || taskTitle,
        subject: taskTitle,
        taskType: taskType,
        ...(dueDate && {
          forObjectType: "CONTACT",
          timestamp: new Date(dueDate).getTime(),
        }),
      },
    };

    // If due date provided, add it
    if (dueDate) {
      taskData.metadata.dueDate = new Date(dueDate).getTime();
    }

    const response = await axios.post(
      `${HUBSPOT_API_BASE}/engagements/v1/engagements`,
      taskData,
      { headers }
    );

    console.log("HubSpot task created:", response.data?.engagement?.id);
    return response.data;
  } catch (error) {
    console.error(
      "Error creating task in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Sync visit target as task in HubSpot
 * @param {Object} visitTarget - Visit target data
 * @param {String} contactId - HubSpot contact ID
 * @returns {Object} Task object or null if failed
 */
const syncVisitTargetAsTask = async (visitTarget, contactId) => {
  try {
    if (!contactId || !visitTarget) return null;

    const taskTitle = `Visit: ${visitTarget.name}`;
    const taskBody =
      `Visit Target: ${visitTarget.name}\n` +
      `Location: ${visitTarget.address || visitTarget.city || "N/A"}\n` +
      `Priority: ${visitTarget.priority || "Medium"}\n` +
      `Status: ${visitTarget.status}\n` +
      (visitTarget.description
        ? `Description: ${visitTarget.description}\n`
        : "") +
      (visitTarget.notes ? `Notes: ${visitTarget.notes}` : "");

    const dueDate = visitTarget.visitDate || visitTarget.createdAt;

    // Task type based on status
    let taskType = "TODO";
    if (visitTarget.status === "Completed") {
      taskType = "COMPLETED";
    } else if (visitTarget.status === "In Progress") {
      taskType = "IN_PROGRESS";
    }

    return await createTask(contactId, taskTitle, taskBody, dueDate, taskType);
  } catch (error) {
    console.error("Error syncing visit target as task:", error.message);
    return null;
  }
};

/**
 * Sync dashboard activities to HubSpot
 * @param {Array} activities - Array of activity objects
 * @param {String} contactId - HubSpot contact ID
 * @returns {Array} Array of created task IDs
 */
const syncDashboardActivities = async (activities, contactId) => {
  try {
    if (!contactId || !activities || activities.length === 0) return [];

    const taskIds = [];
    for (const activity of activities) {
      if (activity.type === "visit" && activity.status !== "Completed") {
        // Create task for pending visits
        const task = await createTask(
          contactId,
          activity.title,
          activity.description,
          activity.date,
          "TODO"
        );
        if (task) taskIds.push(task.engagement?.id);
      }
    }
    return taskIds;
  } catch (error) {
    console.error("Error syncing dashboard activities:", error.message);
    return [];
  }
};

/**
 * Create customer in HubSpot (simplified version)
 * @param {Object} customer - Customer data with properties: firstname, lastname, email, phone, etc.
 * @returns {String|null} HubSpot Customer ID or null if failed
 */
const createCustomerInHubSpot = async (customer) => {
  try {
    const headers = await getHeaders();
    if (!headers) return null;

    const contactProperties = {
      firstname: customer.firstname || customer.firstName || "",
      lastname: customer.lastname || customer.lastName || "",
      email: customer.email || "",
      phone: customer.phone || "",
      company: customer.company || "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      zip: customer.zip || customer.pincode || "",
    };

    const safeContactProperties = await filterToKnownProperties(
      "contacts",
      contactProperties
    );

    const response = await axios.post(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
      { properties: safeContactProperties },
      { headers }
    );

    console.log("HubSpot customer created:", response.data.id);
    return response.data.id;
  } catch (error) {
    console.error(
      "Error creating customer in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Create order in HubSpot (linked to Customer)
 * @param {Object} order - Order data with properties: name, amount, etc.
 * @param {String} customerId - HubSpot Customer ID
 * @returns {String|null} HubSpot Order ID or null if failed
 */
const createOrderInHubSpot = async (order, customerId) => {
  try {
    const headers = await getHeaders();
    if (!headers) return null;

    // Create a REAL Orders object (shows in HubSpot Orders screen).
    // Different portals can have different required order properties,
    // so we auto-fill required properties based on the Orders schema.
    const provided = {
      hs_order_name: order.name || order.dealname || `Order ${Date.now()}`,
      order_name: order.name || order.dealname || `Order ${Date.now()}`,
      dealname: order.name || order.dealname || `Order ${Date.now()}`,
      amount: order.amount?.toString() || "0",
      hs_total_price: order.amount?.toString() || "0",
      status: order.status || "COMPLETED",
      hs_order_status: order.status || "COMPLETED",
      closedate: order.closedate || new Date().toISOString(),
      description: order.description || order.notes || "",
    };

    const orderProperties = await buildRequiredPropertiesPayload(
      "orders",
      provided
    );

    console.log(
      "[HUBSPOT] Creating Orders object with properties keys:",
      Object.keys(orderProperties)
    );
    const response = await axios.post(
      `${HUBSPOT_API_BASE}/crm/v3/objects/orders`,
      { properties: orderProperties },
      { headers }
    );

    const orderId = response.data?.id || null;
    console.log("HubSpot order created (Orders object):", orderId);

    // Associate order with customer
    if (customerId && orderId) {
      try {
        const okOrder = await associateObjects(
          "orders",
          orderId,
          "contacts",
          customerId
        );
        if (okOrder) console.log("Order associated with customer");
      } catch (error) {
        console.error("Error associating order with customer:", error.message);
      }
    }

    return orderId;
  } catch (error) {
    console.error(
      "Error creating order in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Fetch all customers from HubSpot
 * @returns {Array} Array of customer objects or empty array if failed
 */
const fetchCustomers = async () => {
  try {
    const headers = await getHeaders();
    if (!headers) {
      console.warn("HubSpot headers not available - token might be missing");
      return [];
    }

    console.log("Fetching customers from HubSpot...");
    console.log("API URL:", `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`);
    console.log(
      "Token present:",
      !!(config.HUBSPOT_API_KEY || config.HUBSPOT_ACCESS_TOKEN)
    );

    // HubSpot API expects properties as comma-separated string in query params
    const properties = [
      "firstname",
      "lastname",
      "email",
      "phone",
      "company",
      "address",
      "city",
      "state",
      "zip",
    ].join(",");

    const response = await axios.get(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
      {
        headers,
        params: {
          limit: 100,
          properties: properties,
        },
      }
    );

    console.log("HubSpot API Response Status:", response.status);
    console.log(
      "HubSpot API Response Data Keys:",
      Object.keys(response.data || {})
    );

    const customers = response.data?.results || [];
    console.log(
      `Successfully fetched ${customers.length} customers from HubSpot`
    );

    // Log full response structure for debugging
    if (customers.length === 0) {
      console.log(
        "No customers found. Response structure:",
        JSON.stringify(response.data, null, 2)
      );
    } else {
      // Log first customer as sample
      console.log("Sample customer:", JSON.stringify(customers[0], null, 2));
    }

    return customers;
  } catch (error) {
    console.error("Error fetching customers from HubSpot:");
    console.error("Status:", error.response?.status);
    console.error("Status Text:", error.response?.statusText);
    console.error("Error Data:", JSON.stringify(error.response?.data, null, 2));
    console.error("Error Message:", error.message);

    // Return error details for debugging
    throw {
      message: "Failed to fetch customers from HubSpot",
      status: error.response?.status,
      data: error.response?.data,
      originalError: error.message,
    };
  }
};

/**
 * Fetch all orders from HubSpot
 * @returns {Array} Array of order objects or empty array if failed
 */
const fetchOrders = async () => {
  try {
    const headers = await getHeaders();
    if (!headers) {
      console.warn("HubSpot headers not available - token might be missing");
      return [];
    }

    console.log("Fetching orders from HubSpot...");

    // Prefer Orders object first (matches HubSpot Orders screen)
    try {
      const orderProperties = [
        "hs_order_name",
        "hs_order_status",
        "status",
        "hs_total_price",
        "amount",
        "hs_timestamp",
        "hs_createdate",
        "hs_lastmodifieddate",
      ].join(",");

      const response = await axios.get(
        `${HUBSPOT_API_BASE}/crm/v3/objects/orders`,
        {
          headers,
          params: { limit: 100, properties: orderProperties },
        }
      );

      console.log("Orders API Response Status:", response.status);
      const orders = response.data?.results || [];
      console.log(
        `Successfully fetched ${orders.length} orders from HubSpot (Orders API)`
      );
      if (orders.length > 0)
        console.log("Sample order:", JSON.stringify(orders[0], null, 2));
      return orders;
    } catch (orderError) {
      console.log("Orders API failed, trying Deals API...");
      console.log(
        "Orders API Error:",
        orderError.response?.status,
        orderError.response?.data?.message || orderError.message
      );
    }

    // Fallback to Deals API
    const dealProperties = [
      "dealname",
      "amount",
      "dealstage",
      "pipeline",
      "closedate",
      "description",
    ].join(",");
    const response = await axios.get(
      `${HUBSPOT_API_BASE}/crm/v3/objects/deals`,
      {
        headers,
        params: { limit: 100, properties: dealProperties },
      }
    );

    console.log("Deals API Response Status:", response.status);
    const deals = response.data?.results || [];
    console.log(
      `Successfully fetched ${deals.length} deals from HubSpot (Deals API fallback)`
    );
    if (deals.length > 0)
      console.log("Sample deal:", JSON.stringify(deals[0], null, 2));
    return deals;
  } catch (error) {
    console.error("Error fetching orders from HubSpot:");
    console.error("Status:", error.response?.status);
    console.error("Status Text:", error.response?.statusText);
    console.error("Error Data:", JSON.stringify(error.response?.data, null, 2));
    console.error("Error Message:", error.message);

    // Return error details for debugging
    throw {
      message: "Failed to fetch orders from HubSpot",
      status: error.response?.status,
      data: error.response?.data,
      originalError: error.message,
    };
  }
};

/**
 * Fetch tasks from HubSpot
 * @returns {Array} Array of task objects or empty array if failed
 */
const fetchTasks = async () => {
  try {
    const headers = await getHeaders();
    if (!headers) {
      console.warn("HubSpot headers not available - token might be missing");
      return [];
    }

    console.log("Fetching tasks from HubSpot...");

    // HubSpot tasks are CRM object "tasks"
    const taskProperties = [
      "hs_task_subject",
      "hs_task_body",
      "hs_task_status",
      "hs_task_priority",
      "hs_task_type",
      "hs_timestamp", // commonly used as due date/time
      "hs_createdate",
      "hs_lastmodifieddate",
    ].join(",");

    const response = await axios.get(
      `${HUBSPOT_API_BASE}/crm/v3/objects/tasks`,
      {
        headers,
        params: {
          limit: 100,
          properties: taskProperties,
          associations: "contacts",
        },
      }
    );

    const tasks = response.data?.results || [];
    console.log(`Successfully fetched ${tasks.length} tasks from HubSpot`);
    if (tasks.length > 0) {
      console.log("Sample task:", JSON.stringify(tasks[0], null, 2));
    }
    return tasks;
  } catch (error) {
    console.error(
      "Error fetching tasks from HubSpot:",
      error.response?.data || error.message
    );
    return [];
  }
};

/**
 * Create task in HubSpot (CRM v3 tasks object)
 * @param {Object} task - { subject, body, status, priority, type, dueDate }
 * @returns {String|null} HubSpot task id
 */
const createTaskObjectInHubSpot = async (task = {}) => {
  try {
    const headers = await getHeaders();
    if (!headers) return null;

    const subject = (task.subject || "").toString();
    const body = (task.body || "").toString();
    const status = (task.status || "NOT_STARTED").toString(); // NOT_STARTED | IN_PROGRESS | COMPLETED | WAITING
    const priority = (task.priority || "NONE").toString(); // NONE | LOW | MEDIUM | HIGH
    const type = (task.type || "TODO").toString(); // TODO | CALL | EMAIL (varies by portal)

    // HubSpot expects hs_timestamp as epoch millis (commonly due date/time)
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const hs_timestamp =
      due && !Number.isNaN(due.getTime()) ? String(due.getTime()) : undefined;

    const response = await axios.post(
      `${HUBSPOT_API_BASE}/crm/v3/objects/tasks`,
      {
        properties: {
          hs_task_subject: subject,
          hs_task_body: body,
          hs_task_status: status,
          hs_task_priority: priority,
          hs_task_type: type,
          ...(hs_timestamp ? { hs_timestamp } : {}),
        },
      },
      { headers }
    );

    return response.data?.id || null;
  } catch (error) {
    console.error(
      "Error creating task object in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Create task in HubSpot (simplified version)
 * @param {String} subject - Task subject/title
 * @param {String} contactId - HubSpot contact ID (optional)
 * @returns {Object} Task object or null if failed
 */
const createTaskInHubSpot = async (subject, contactId = null) => {
  try {
    const headers = await getHeaders();
    if (!headers) return null;

    const taskData = {
      engagement: {
        type: "TASK",
        active: true,
      },
      metadata: {
        body: subject,
        subject: subject,
        hs_task_subject: subject,
        hs_task_status: "NOT_STARTED",
        hs_task_priority: "HIGH",
      },
    };

    // Associate with contact if provided
    if (contactId) {
      taskData.associations = {
        contactIds: [contactId],
      };
    }

    const response = await axios.post(
      `${HUBSPOT_API_BASE}/engagements/v1/engagements`,
      taskData,
      { headers }
    );

    console.log("HubSpot task created:", response.data?.engagement?.id);
    return response.data;
  } catch (error) {
    console.error(
      "Error creating task in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Sync HubSpot data to website database
 * Fetches customers and orders from HubSpot
 * @returns {Object} Object with customers and orders arrays
 */
const syncHubSpotData = async () => {
  try {
    const customers = await fetchCustomers();
    const orders = await fetchOrders();

    console.log(
      `HubSpot sync: ${customers.length} customers, ${orders.length} orders fetched`
    );

    return {
      customers,
      orders,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error syncing HubSpot data:", error.message);
    return {
      customers: [],
      orders: [],
      error: error.message,
    };
  }
};

module.exports = {
  createOrUpdateContact,
  createDeal,
  createTimelineEvent,
  createNote,
  updateContactProperty,
  findContactByEmail,
  createTask,
  syncVisitTargetAsTask,
  syncDashboardActivities,
  // New functions for direct API integration
  createCustomerInHubSpot,
  createOrderInHubSpot,
  associateOrderToContact,
  fetchCustomers,
  fetchOrders,
  fetchTasks,
  createTaskObjectInHubSpot,
  createTaskInHubSpot,
  syncHubSpotData,
};
