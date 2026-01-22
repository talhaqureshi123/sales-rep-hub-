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
 * @param {Object} options - Options for creating/updating contact
 * @param {Boolean} options.assignToMe - If true, assign contact to current user
 * @returns {Object} HubSpot contact object or null if failed
 */
const createOrUpdateContact = async (customerData, options = {}) => {
  try {
    const headers = await getHeaders();
    if (!headers) return null;

    const { assignToMe = false } = options;

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

    // If assignToMe is true, get current user ID and assign contact to them
    let ownerIdToAssign = null;
    if (assignToMe) {
      const currentUserId = await getCurrentHubSpotUserId();
      if (currentUserId) {
        ownerIdToAssign = currentUserId;
        contactProperties.hubspot_owner_id = currentUserId;
        console.log(`Assigning contact to owner ID: ${currentUserId}`);
      } else {
        console.warn('⚠️ assignToMe is true but could not determine current HubSpot owner ID. Contact will not be assigned.');
      }
    }

    const safeContactProperties = await filterToKnownProperties(
      "contacts",
      contactProperties
    );

    // Ensure hubspot_owner_id is preserved after filtering (in case it was filtered out)
    if (ownerIdToAssign) {
      safeContactProperties.hubspot_owner_id = ownerIdToAssign;
    }

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

    // DUPLICATE PREVENTION: Check if customer already exists by email
    const email = customer.email || customer.emailAddress || "";
    if (email && isValidEmail(email)) {
      const existingContactId = await findContactByEmail(email);
      if (existingContactId) {
        console.log(`Customer with email ${email} already exists in HubSpot: ${existingContactId}`);
        // Update existing contact instead of creating duplicate
        try {
          const contactProperties = {
            firstname: customer.firstname || customer.firstName || "",
            lastname: customer.lastname || customer.lastName || "",
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

          await axios.patch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${existingContactId}`,
            { properties: safeContactProperties },
            { headers }
          );

          console.log(`HubSpot customer updated (prevented duplicate): ${existingContactId}`);
          return existingContactId;
        } catch (updateError) {
          console.error("Error updating existing customer:", updateError.message);
          // Return existing ID even if update fails
          return existingContactId;
        }
      }
    }

    // Create new customer if not found
    const contactProperties = {
      firstname: customer.firstname || customer.firstName || "",
      lastname: customer.lastname || customer.lastName || "",
      email: email,
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
    // Check if error is due to duplicate email
    if (error.response?.status === 409 || error.response?.data?.message?.includes('duplicate') || error.response?.data?.message?.includes('already exists')) {
      console.warn("Customer already exists in HubSpot, attempting to find by email...");
      const email = customer.email || customer.emailAddress || "";
      if (email && isValidEmail(email)) {
        const existingId = await findContactByEmail(email);
        if (existingId) {
          console.log(`Found existing customer: ${existingId}`);
          return existingId;
        }
      }
    }
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

    // DUPLICATE PREVENTION: Check if order already has HubSpot ID
    // This should be checked before calling this function, but we add safety check here too
    if (order.hubspotOrderId) {
      console.log(`Order already has HubSpot ID: ${order.hubspotOrderId} - skipping duplicate creation`);
      return order.hubspotOrderId;
    }

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
    if (orderId) {
      console.log("✅ HubSpot order created (Orders object):", orderId);
    }

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
    // Check if error is due to duplicate
    if (error.response?.status === 409 || error.response?.data?.message?.includes('duplicate')) {
      console.warn("Order might already exist in HubSpot (duplicate detected)");
      return null; // Return null to prevent duplicate
    }
    console.error(
      "Error creating order in HubSpot:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Get current HubSpot user ID from access token
 * @returns {String|null} HubSpot owner ID or null if failed
 */
const getCurrentHubSpotUserId = async () => {
  try {
    const headers = await getHeaders();
    if (!headers) {
      console.warn('No HubSpot headers available');
      return null;
    }

    console.log('Attempting to get current HubSpot user/owner ID...');

    // Method 1: Try /integrations/v1/me endpoint (works with OAuth and some private apps)
    try {
      const userResponse = await axios.get(
        `${HUBSPOT_API_BASE}/integrations/v1/me`,
        { headers }
      );
      const userId = userResponse.data?.user_id || userResponse.data?.userId;
      if (userId) {
        console.log(`✅ Current HubSpot user ID (from /me): ${userId}`);
        // For /me endpoint, userId might be user ID, not owner ID
        // We need to convert it to owner ID
        return await convertUserIdToOwnerId(userId, headers) || String(userId);
      }
    } catch (meError) {
      console.log('Method 1 (/me) failed:', meError.response?.status, meError.response?.data?.message || meError.message);
    }

    // Method 2: Try token metadata endpoint (for OAuth tokens)
    try {
      const accessToken = headers.Authorization?.replace('Bearer ', '');
      if (accessToken) {
        const response = await axios.get(
          `${HUBSPOT_API_BASE}/oauth/v1/access-tokens/${accessToken}`,
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        const userId = response.data?.user_id;
        if (userId) {
          console.log(`✅ Current HubSpot user ID (from token metadata): ${userId}`);
          // Convert user ID to owner ID
          return await convertUserIdToOwnerId(userId, headers) || String(userId);
        }
      }
    } catch (tokenError) {
      console.log('Method 2 (token metadata) failed:', tokenError.response?.status, tokenError.response?.data?.message || tokenError.message);
    }

    // Method 3: Try to get owners list and use first active owner (for Private Apps)
    // This is a fallback - assumes first owner is the token owner
    try {
      const ownersResponse = await axios.get(
        `${HUBSPOT_API_BASE}/crm/v3/owners`,
        { 
          headers,
          params: { limit: 100 }
        }
      );
      
      const owners = ownersResponse.data?.results || [];
      if (owners.length > 0) {
        // Find first active (non-archived) owner
        const activeOwner = owners.find(o => !o.archived) || owners[0];
        if (activeOwner?.id) {
          console.log(`✅ Using first active owner ID (Private App fallback): ${activeOwner.id}`);
          console.log(`   Owner: ${activeOwner.firstName || ''} ${activeOwner.lastName || ''} (${activeOwner.email || 'no email'})`);
          return String(activeOwner.id);
        }
      }
    } catch (ownersError) {
      console.log('Method 3 (owners list) failed:', ownersError.response?.status, ownersError.response?.data?.message || ownersError.message);
    }

    // Method 4: Try to fetch a sample contact and check its owner_id
    // This assumes the token owner has at least one contact
    try {
      const sampleResponse = await axios.get(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
        {
          headers,
          params: {
            limit: 1,
            properties: 'hubspot_owner_id'
          }
        }
      );
      
      const sampleContact = sampleResponse.data?.results?.[0];
      const ownerId = sampleContact?.properties?.hubspot_owner_id;
      if (ownerId) {
        console.log(`✅ Found owner ID from sample contact: ${ownerId}`);
        console.log(`   ⚠️  WARNING: This might not be YOUR owner ID, just a sample contact's owner`);
        return String(ownerId);
      }
    } catch (sampleError) {
      console.log('Method 4 (sample contact) failed:', sampleError.response?.status);
    }

    // All methods failed
    console.warn('❌ Could not determine HubSpot user/owner ID. All methods failed.');
    console.warn('   This might be a Private App token without user context.');
    console.warn('   Will fetch all contacts instead of filtering by owner.');
    return null;
  } catch (error) {
    console.error('Error getting HubSpot user ID:', error.message);
    return null;
  }
};

/**
 * Convert HubSpot user ID to owner ID
 * @param {String} userId - HubSpot user ID
 * @param {Object} headers - API headers
 * @returns {String|null} Owner ID or null if failed
 */
const convertUserIdToOwnerId = async (userId, headers) => {
  try {
    // Fetch owners list and find owner with matching userId
    const ownersResponse = await axios.get(
      `${HUBSPOT_API_BASE}/crm/v3/owners`,
      { 
        headers,
        params: { limit: 100 }
      }
    );
    
    const owners = ownersResponse.data?.results || [];
    const matchingOwner = owners.find(o => String(o.userId) === String(userId));
    
    if (matchingOwner?.id) {
      console.log(`   Converted user ID ${userId} to owner ID ${matchingOwner.id}`);
      return String(matchingOwner.id);
    }
    
    return null;
  } catch (error) {
    console.log('Error converting user ID to owner ID:', error.message);
    return null;
  }
};

/**
 * Get HubSpot owner details by owner ID
 * @param {String} ownerId - HubSpot owner ID
 * @returns {Object|null} Owner object with { id, firstName, lastName, email } or null if failed
 */
const getOwnerById = async (ownerId) => {
  try {
    if (!ownerId) return null;
    
    const headers = await getHeaders();
    if (!headers) return null;
    
    const ownersResponse = await axios.get(
      `${HUBSPOT_API_BASE}/crm/v3/owners/${ownerId}`,
      { headers, timeout: 10000 }
    );
    
    const owner = ownersResponse.data;
    if (owner?.id) {
      return {
        id: String(owner.id),
        firstName: owner.firstName || '',
        lastName: owner.lastName || '',
        email: owner.email || '',
        fullName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'No Owner'
      };
    }
    
    return null;
  } catch (error) {
    console.log(`Error fetching owner ${ownerId}:`, error.message);
    return null;
  }
};

/**
 * Fetch all customers from HubSpot
 * @param {Object} options - Options for fetching customers
 * @param {Boolean} options.myContactsOnly - If true, only fetch contacts owned by current user
 * @returns {Array} Array of customer objects or empty array if failed
 */
const fetchCustomers = async (options = {}) => {
  try {
    const headers = await getHeaders();
    if (!headers) {
      console.warn("HubSpot headers not available - token might be missing");
      return [];
    }

    const { myContactsOnly = false } = options;

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
      "hubspot_owner_id", // Include owner ID to filter
    ].join(",");

    // If filtering by owner, use search API
    if (myContactsOnly) {
      console.log("Fetching MY contacts from HubSpot (owner filter)...");
      
      // Get current user's HubSpot ID
      const currentUserId = await getCurrentHubSpotUserId();
      
      if (!currentUserId) {
        console.error("❌ ERROR: Could not determine current HubSpot user/owner ID.");
        console.error("   This usually happens with Private App tokens that don't have user context.");
        console.error("   'My Contacts' filter cannot work without knowing your owner ID.");
        console.error("   Returning empty array. Please check backend logs for details.");
        // Return empty array instead of falling back to all contacts
        // This makes it clear that "My Contacts" filter failed
        return [];
      }
      
      console.log(`✅ Using owner ID: ${currentUserId} to filter MY contacts`);

      // Use search API to filter by owner with pagination support
      let allCustomers = [];
      let after = null;
      let hasMore = true;
      const pageSize = 100; // HubSpot max per request

      while (hasMore) {
        const searchPayload = {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "hubspot_owner_id",
                  operator: "EQ",
                  value: currentUserId,
                },
              ],
            },
          ],
          properties: properties.split(','),
          limit: pageSize,
        };

        // Add pagination cursor if available
        if (after) {
          searchPayload.after = after;
        }

        const searchResponse = await axios.post(
          `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
          searchPayload,
          { headers }
        );

        const pageResults = searchResponse.data?.results || [];
        allCustomers = allCustomers.concat(pageResults);

        // Check if there are more pages
        const paging = searchResponse.data?.paging;
        after = paging?.next?.after || null;
        hasMore = !!after && pageResults.length === pageSize;

        console.log(`Fetched ${pageResults.length} contacts (Total so far: ${allCustomers.length})`);
      }

      console.log(`Successfully fetched ${allCustomers.length} MY contacts from HubSpot`);
      
      if (allCustomers.length > 0) {
        console.log("Sample MY contact:", JSON.stringify(allCustomers[0], null, 2));
      }
      
      return allCustomers;
    }

    // Otherwise, fetch all contacts (original behavior)
    console.log("Fetching all customers from HubSpot...");
    console.log("API URL:", `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`);
    console.log(
      "Token present:",
      !!(config.HUBSPOT_API_KEY || config.HUBSPOT_ACCESS_TOKEN)
    );

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
 * @param {Object} options - Options for fetching orders
 * @param {Boolean} options.currentMonthOnly - If true, only fetch orders from current month (default: true)
 * @returns {Array} Array of order objects or empty array if failed
 */
const fetchOrders = async (options = {}) => {
  const currentMonthOnly = options.currentMonthOnly !== false; // Default to true
  
  try {
    const headers = await getHeaders();
    if (!headers) {
      console.warn("HubSpot headers not available - token might be missing");
      return [];
    }

    console.log(`Fetching orders from HubSpot (Current Month Only: ${currentMonthOnly})...`);

    const { startDate, endDate } = getCurrentMonthRange();
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

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
      ];

      let orders = [];

      if (currentMonthOnly) {
        // Use search API to filter by current month
        console.log(`Filtering orders from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
        
        const searchPayload = {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "hs_createdate",
                  operator: "BETWEEN",
                  value: startTimestamp,
                  highValue: endTimestamp,
                },
              ],
            },
          ],
          properties: orderProperties,
          limit: 100,
        };

        try {
          const searchResponse = await axios.post(
            `${HUBSPOT_API_BASE}/crm/v3/objects/orders/search`,
            searchPayload,
            { headers }
          );
          orders = searchResponse.data?.results || [];
          console.log(`Fetched ${orders.length} orders from current month using search API`);
        } catch (searchError) {
          console.warn("Orders search API failed, falling back to get API with client-side filtering:", searchError.message);
          // Fallback to get API and filter client-side
          const response = await axios.get(
            `${HUBSPOT_API_BASE}/crm/v3/objects/orders`,
            {
              headers,
              params: { limit: 100, properties: orderProperties.join(",") },
            }
          );
          const allOrders = response.data?.results || [];
          
          // Filter by current month client-side
          orders = allOrders.filter((order) => {
            const createdDate = order?.properties?.hs_createdate;
            if (!createdDate) return false;
            const createdMs = Date.parse(createdDate);
            if (isNaN(createdMs)) return false;
            return createdMs >= startTimestamp && createdMs <= endTimestamp;
          });
          console.log(`Filtered ${orders.length} orders from current month (from ${allOrders.length} total)`);
        }
      } else {
        // Fetch all orders
        const response = await axios.get(
          `${HUBSPOT_API_BASE}/crm/v3/objects/orders`,
          {
            headers,
            params: { limit: 100, properties: orderProperties.join(",") },
          }
        );
        orders = response.data?.results || [];
        console.log(`Fetched ${orders.length} orders (all orders, no date filter)`);
      }

      console.log(
        `Successfully fetched ${orders.length} orders from HubSpot (Orders API${currentMonthOnly ? ' - current month only' : ''})`
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
      "hs_createdate",
      "hs_lastmodifieddate",
    ];

    let deals = [];

    if (currentMonthOnly) {
      // Use search API to filter deals by current month
      console.log(`Filtering deals from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
      
      const searchPayload = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "hs_createdate",
                operator: "BETWEEN",
                value: startTimestamp,
                highValue: endTimestamp,
              },
            ],
          },
        ],
        properties: dealProperties,
        limit: 100,
      };

      try {
        const searchResponse = await axios.post(
          `${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`,
          searchPayload,
          { headers }
        );
        deals = searchResponse.data?.results || [];
        console.log(`Fetched ${deals.length} deals from current month using search API`);
      } catch (searchError) {
        console.warn("Deals search API failed, falling back to get API with client-side filtering:", searchError.message);
        // Fallback to get API and filter client-side
        const response = await axios.get(
          `${HUBSPOT_API_BASE}/crm/v3/objects/deals`,
          {
            headers,
            params: { limit: 100, properties: dealProperties.join(",") },
          }
        );
        const allDeals = response.data?.results || [];
        
        // Filter by current month client-side
        deals = allDeals.filter((deal) => {
          const createdDate = deal?.properties?.hs_createdate;
          if (!createdDate) return false;
          const createdMs = Date.parse(createdDate);
          if (isNaN(createdMs)) return false;
          return createdMs >= startTimestamp && createdMs <= endTimestamp;
        });
        console.log(`Filtered ${deals.length} deals from current month (from ${allDeals.length} total)`);
      }
    } else {
      // Fetch all deals
      const response = await axios.get(
        `${HUBSPOT_API_BASE}/crm/v3/objects/deals`,
        {
          headers,
          params: { limit: 100, properties: dealProperties.join(",") },
        }
      );
      deals = response.data?.results || [];
      console.log(`Fetched ${deals.length} deals (all deals, no date filter)`);
    }

    console.log(
      `Successfully fetched ${deals.length} deals from HubSpot (Deals API fallback${currentMonthOnly ? ' - current month only' : ''})`
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
 * Get current month date range (start and end of current month)
 * @returns {Object} { startDate: Date, endDate: Date }
 */
const getCurrentMonthRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

/**
 * Get week ranges for current month (previous week, current week, next week)
 * Only includes weeks that fall within the current month
 * @returns {Object} { startDate: Date, endDate: Date }
 */
const getCurrentMonthWeekRange = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentDate = now.getDate();
  
  // Get start of current week (Monday)
  // If Sunday (0), go back 6 days; otherwise go back (day - 1) days
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(currentDate - daysToMonday);
  currentWeekStart.setHours(0, 0, 0, 0);
  
  // Get end of current week (Sunday)
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
  currentWeekEnd.setHours(23, 59, 59, 999);
  
  // Get previous week (7 days before current week start)
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(currentWeekStart.getDate() - 7);
  previousWeekStart.setHours(0, 0, 0, 0);
  
  const previousWeekEnd = new Date(previousWeekStart);
  previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
  previousWeekEnd.setHours(23, 59, 59, 999);
  
  // Get next week (7 days after current week start)
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);
  nextWeekStart.setHours(0, 0, 0, 0);
  
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
  nextWeekEnd.setHours(23, 59, 59, 999);
  
  // Get current month boundaries
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Find the earliest start date (previous week start, but not before month start)
  let startDate = previousWeekStart;
  if (startDate < monthStart) {
    startDate = monthStart;
  }
  
  // CRITICAL FIX: Always extend endDate to month end to ensure ALL dates in current month are included
  // This ensures tasks like 30 Jan are included even if they're beyond the "next week" range
  // Week-wise means we start from previous week, but we include ALL dates in the current month
  let endDate = new Date(monthEnd); // Always use full month end, not just next week end
  
  console.log(`📅 Week range calculation:`);
  console.log(`   Previous week: ${previousWeekStart.toLocaleDateString('en-GB')} to ${previousWeekEnd.toLocaleDateString('en-GB')}`);
  console.log(`   Current week: ${currentWeekStart.toLocaleDateString('en-GB')} to ${currentWeekEnd.toLocaleDateString('en-GB')}`);
  console.log(`   Next week: ${nextWeekStart.toLocaleDateString('en-GB')} to ${nextWeekEnd.toLocaleDateString('en-GB')}`);
  console.log(`   Month range: ${monthStart.toLocaleDateString('en-GB')} to ${monthEnd.toLocaleDateString('en-GB')}`);
  console.log(`   Final range: ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')} (extended to month end to include all month dates)`);
  
  // Check if 30 Jan (if current month is January) is in range
  if (now.getMonth() === 0) { // January is month 0
    const jan30 = new Date(now.getFullYear(), 0, 30, 12, 0, 0, 0);
    const jan30Timestamp = jan30.getTime();
    const inRange = jan30Timestamp >= startDate.getTime() && jan30Timestamp <= endDate.getTime();
    console.log(`   📌 30 Jan check: ${jan30.toLocaleDateString('en-GB')} is ${inRange ? '✅ IN RANGE' : '❌ OUT OF RANGE'}`);
  }
  
  return { startDate, endDate };
};

/**
 * Fetch tasks from HubSpot
 * @param {Object} options - Options for fetching tasks
 * @param {Number} options.limit - Maximum number of tasks to fetch (default: 100, max: 100)
 * @param {Boolean} options.currentMonthOnly - If true, only fetch tasks from current month weeks (default: false)
 * @param {Boolean} options.weekWise - If true, fetch tasks from previous week, current week, and next week within current month (default: true when currentMonthOnly is true)
 * @returns {Array} Array of task objects or empty array if failed
 */
const fetchTasks = async (options = {}) => {
  // HubSpot API allows maximum 100 objects per request
  const limit = Math.min(options.limit || 100, 100);
  const currentMonthOnly = options.currentMonthOnly === true; // Default to false
  const weekWise = options.weekWise !== false; // Default to true when filtering
  
  try {
    const headers = await getHeaders();
    if (!headers) {
      console.warn("HubSpot headers not available - token might be missing");
      return [];
    }

    console.log(`Fetching tasks from HubSpot (Current Month Only: ${currentMonthOnly}, Week Wise: ${weekWise})...`);

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
      "hubspot_owner_id", // Owner/assigned user ID
      "hs_task_queue", // Queue field
      "hs_task_reminder", // Reminder field
    ];

    let tasks = [];

    if (currentMonthOnly) {
      // Use week-wise filtering: previous week, current week, next week within current month
      const { startDate, endDate } = weekWise ? getCurrentMonthWeekRange() : getCurrentMonthRange();
      const startTimestamp = startDate.getTime();
      const endTimestamp = endDate.getTime();

      console.log(`Filtering tasks by due date (hs_timestamp) from ${startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} to ${endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`);

      // Use search API with date filter on hs_timestamp (due date) instead of hs_createdate
      // This ensures all tasks for a day are imported regardless of time
      const searchPayload = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "hs_timestamp", // Filter by due date, not creation date
                operator: "BETWEEN",
                value: startTimestamp,
                highValue: endTimestamp,
              },
            ],
          },
        ],
        properties: taskProperties,
        limit: limit,
        associations: ["contacts", "companies"], // Request associations for contacts and companies
      };
      
      console.log(`🔍 Search payload for tasks (filtering by due date):`, JSON.stringify(searchPayload, null, 2));

      try {
        const searchResponse = await axios.post(
          `${HUBSPOT_API_BASE}/crm/v3/objects/tasks/search`,
          searchPayload,
          { headers }
        );
        tasks = searchResponse.data?.results || [];
        const totalCount = searchResponse.data?.total || tasks.length;
        console.log(`Fetched ${tasks.length} tasks from current month weeks using search API (with associations)`);
        console.log(`📊 Total tasks available in HubSpot for this date range: ${totalCount}`);
        
        // Warn if we hit the limit and there are more tasks
        if (totalCount > limit && tasks.length === limit) {
          console.warn(`⚠️ WARNING: HubSpot has ${totalCount} tasks in this date range, but we only fetched ${limit} (limit reached). Some tasks may be missing!`);
          console.warn(`   Consider increasing the limit or implementing pagination to fetch all tasks.`);
        }
        
        // Debug: Check if associations are present
        if (tasks.length > 0) {
          const sampleTask = tasks[0];
          console.log(`🔍 Sample task associations:`, {
            hasAssociations: !!sampleTask?.associations,
            associationKeys: Object.keys(sampleTask?.associations || {}),
            contactCount: (sampleTask?.associations?.contacts?.results || []).length,
            companyCount: (sampleTask?.associations?.companies?.results || []).length
          });
          
          // Log tasks with 30 Jan 13:00 specifically
          const jan30_13_00_tasks = tasks.filter(t => {
            const tsRaw = t?.properties?.hs_timestamp;
            if (!tsRaw) return false;
            let tsNum = Number(tsRaw);
            if (tsNum > 0 && tsNum < 946684800000) {
              tsNum = tsNum * 1000;
            }
            if (isNaN(tsNum) || tsNum <= 0) return false;
            const dueDate = new Date(tsNum);
            return dueDate.getDate() === 30 && dueDate.getMonth() === 0 && dueDate.getHours() === 13 && dueDate.getMinutes() === 0;
          });
          
          if (jan30_13_00_tasks.length > 0) {
            console.log(`\n✅ Found ${jan30_13_00_tasks.length} task(s) with due date 30 Jan 2026 13:00 in fetched results:`);
            jan30_13_00_tasks.forEach((t, idx) => {
              const subj = (t?.properties?.hs_task_subject || '').trim() || 'No subject';
              const taskId = String(t?.id || '').trim() || 'No ID';
              console.log(`   ${idx + 1}. Task ${taskId}: "${subj}"`);
            });
          } else {
            console.log(`\n⚠️ No tasks found with due date 30 Jan 2026 13:00 in fetched results.`);
            console.log(`   This might indicate they're beyond the limit or not in the date range.`);
          }
        }
      } catch (searchError) {
        console.warn("Search API failed, falling back to get API with client-side filtering:", searchError.message);
        // Fallback to get API and filter client-side
        const response = await axios.get(
          `${HUBSPOT_API_BASE}/crm/v3/objects/tasks`,
          {
            headers,
            params: {
              limit: limit,
              properties: taskProperties.join(","),
              associations: "contacts,companies", // Request both contacts and companies associations
            },
          }
        );
        const allTasks = response.data?.results || [];
        
        // Filter by due date (hs_timestamp) client-side - includes all times in the day
        tasks = allTasks.filter((task) => {
          const dueDate = task?.properties?.hs_timestamp;
          if (!dueDate) return false;
          const dueMs = Number(dueDate);
          if (isNaN(dueMs) || dueMs <= 0) return false;
          return dueMs >= startTimestamp && dueMs <= endTimestamp;
        });
        console.log(`Filtered ${tasks.length} tasks from current month weeks by due date (from ${allTasks.length} total)`);
      }
    } else {
      // Fetch all tasks (original behavior)
      console.log(`Fetching all tasks from HubSpot (limit: ${limit}, no date filter)`);
      const response = await axios.get(
        `${HUBSPOT_API_BASE}/crm/v3/objects/tasks`,
        {
          headers,
          params: {
            limit: limit,
            properties: taskProperties.join(","),
            associations: "contacts,companies", // Request both contacts and companies associations
          },
        }
      );
      tasks = response.data?.results || [];
      console.log(`Fetched ${tasks.length} tasks (all tasks, no date filter)`);
    }
    
    // Sort by due date (hs_timestamp) or creation date (newest first)
    tasks.sort((a, b) => {
      const aTimestamp = a?.properties?.hs_timestamp ? Number(a.properties.hs_timestamp) : 0;
      const bTimestamp = b?.properties?.hs_timestamp ? Number(b.properties.hs_timestamp) : 0;
      const aCreated = a?.properties?.hs_createdate ? new Date(a.properties.hs_createdate).getTime() : 0;
      const bCreated = b?.properties?.hs_createdate ? new Date(b.properties.hs_createdate).getTime() : 0;
      
      const aDate = aTimestamp || aCreated;
      const bDate = bTimestamp || bCreated;
      
      return bDate - aDate; // Descending order (newest first)
    });
    
    console.log(`Successfully fetched ${tasks.length} tasks from HubSpot${currentMonthOnly ? (weekWise ? ' (current month: previous week, current week, next week)' : ' (current month only)') : ''}`);
    if (tasks.length > 0) {
      const newestTask = tasks[0];
      const oldestTask = tasks[tasks.length - 1];
      
      // Helper to parse timestamp safely
      const parseTimestamp = (ts) => {
        if (!ts) return null;
        const num = Number(ts);
        if (!isNaN(num) && num > 0) {
          return new Date(num);
        }
        return null;
      };
      
      const newestDue = parseTimestamp(newestTask?.properties?.hs_timestamp);
      const oldestDue = parseTimestamp(oldestTask?.properties?.hs_timestamp);
      
      console.log("Newest task due date:", newestDue ? newestDue.toLocaleDateString() : 'N/A');
      console.log("Oldest task due date:", oldestDue ? oldestDue.toLocaleDateString() : 'N/A');
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
 * Update task in HubSpot (CRM v3 tasks object)
 * @param {String} taskId - HubSpot task ID
 * @param {Object} task - { subject, body, status, priority, type, dueDate }
 * @returns {Boolean} Success status
 */
const updateTaskObjectInHubSpot = async (taskId, task = {}) => {
  try {
    const headers = await getHeaders();
    if (!headers || !taskId) return false;

    const subject = (task.subject || "").toString();
    const body = (task.body || "").toString();
    const status = (task.status || "NOT_STARTED").toString();
    const priority = (task.priority || "NONE").toString();
    const type = (task.type || "TODO").toString();

    // HubSpot expects hs_timestamp as epoch millis
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const hs_timestamp =
      due && !Number.isNaN(due.getTime()) ? String(due.getTime()) : undefined;

    const properties = {
      hs_task_subject: subject,
      hs_task_body: body,
      hs_task_status: status,
      hs_task_priority: priority,
      hs_task_type: type,
    };
    
    if (hs_timestamp) {
      properties.hs_timestamp = hs_timestamp;
    }

    await axios.patch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/tasks/${taskId}`,
      { properties },
      { headers }
    );

    console.log(`✅ HubSpot task updated: ${taskId} - "${subject}"`);
    return true;
  } catch (error) {
    console.error(
      "Error updating task object in HubSpot:",
      error.response?.data || error.message
    );
    return false;
  }
};

/**
 * Create task in HubSpot (CRM v3 tasks object)
 * @param {Object} task - { subject, body, status, priority, type, dueDate, contactId, contactEmail }
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

    // DUPLICATE PREVENTION: Check if task with same subject and due date already exists
    // Note: This is a basic check. For strict prevention, store hubspotTaskId in database (already done)
    
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

    const taskId = response.data?.id || null;
    if (!taskId) {
      return null;
    }

    // Associate task with contact if contactId or contactEmail is provided
    let contactId = task.contactId;
    if (!contactId && task.contactEmail && isValidEmail(task.contactEmail)) {
      // Try to find contact by email
      contactId = await findContactByEmail(task.contactEmail);
    }

    if (contactId) {
      try {
        // Associate task with contact using v4 associations API
        const associated = await associateObjects("tasks", taskId, "contacts", contactId);
        if (associated) {
          console.log(`✅ HubSpot task created: ${taskId} - "${subject}" (associated with contact: ${contactId})`);
        } else {
          console.log(`✅ HubSpot task created: ${taskId} - "${subject}" (contact association failed)`);
        }
      } catch (assocError) {
        console.warn(`⚠️ Task ${taskId} created but contact association failed:`, assocError.message);
        console.log(`✅ HubSpot task created: ${taskId} - "${subject}"`);
      }
    } else {
      console.log(`✅ HubSpot task created: ${taskId} - "${subject}" (no contact association)`);
    }

    return taskId;
  } catch (error) {
    // Check if error is due to duplicate
    if (error.response?.status === 409 || error.response?.data?.message?.includes('duplicate')) {
      console.warn("Task might already exist in HubSpot (duplicate detected)");
      return null; // Return null to prevent duplicate
    }
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
const syncHubSpotData = async (options = {}) => {
  try {
    const currentMonthOnly = options.currentMonthOnly !== false; // Default to true
    const customers = await fetchCustomers();
    const orders = await fetchOrders({ currentMonthOnly });

    console.log(
      `HubSpot sync: ${customers.length} customers, ${orders.length} orders fetched${currentMonthOnly ? ' (current month only)' : ''}`
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
  updateTaskObjectInHubSpot,
  createTaskInHubSpot,
  syncHubSpotData,
  getCurrentHubSpotUserId,
  getOwnerById,
};
