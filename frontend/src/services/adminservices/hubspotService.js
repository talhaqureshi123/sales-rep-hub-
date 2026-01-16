// Admin HubSpot Service - Handles HubSpot integration via backend API

const API_BASE_URL = '/api/admin/hubspot'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Create customer and order in HubSpot
export const createCustomerAndOrder = async (customerData, orderData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        customer: customerData,
        order: orderData,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating customer and order in HubSpot:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Fetch customers from HubSpot
export const getHubSpotCustomers = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/customers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching customers from HubSpot:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Fetch orders from HubSpot
export const getHubSpotOrders = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching orders from HubSpot:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Sync HubSpot data (customers and orders)
export const syncHubSpotData = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error syncing HubSpot data:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Import HubSpot contacts into local Customers DB
export const importHubSpotCustomersToDb = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/import-customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error importing HubSpot customers to DB:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Import HubSpot tasks into local Follow-Ups DB
export const importHubSpotTasksToDb = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/import-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error importing HubSpot tasks to DB:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Push existing SalesOrders from website DB to HubSpot Orders
export const pushSalesOrdersToHubSpot = async (force = false, limit = 0) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/push-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ force, limit }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error pushing sales orders to HubSpot:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Push existing Customers from website DB to HubSpot Contacts
export const pushCustomersToHubSpot = async (force = false, limit = 0) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/push-customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ force, limit }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error pushing customers to HubSpot:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create task in HubSpot
export const createHubSpotTask = async (subject, contactId = null) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        subject,
        contactId,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating task in HubSpot:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Test HubSpot connection
export const testHubSpotConnection = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error testing HubSpot connection:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  createCustomerAndOrder,
  getHubSpotCustomers,
  getHubSpotOrders,
  syncHubSpotData,
  createHubSpotTask,
  testHubSpotConnection,
  importHubSpotCustomersToDb,
  importHubSpotTasksToDb,
  pushSalesOrdersToHubSpot,
  pushCustomersToHubSpot,
}
