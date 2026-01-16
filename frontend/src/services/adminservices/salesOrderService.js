// Admin Sales Order Service - Handles sales order management via backend API

const API_BASE_URL = '/api/admin/sales-orders'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all sales orders
export const getSalesOrders = async (params = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    // Build query string
    const queryParams = new URLSearchParams()
    if (params.status) queryParams.append('status', params.status)
    if (params.search) queryParams.append('search', params.search)
    if (params.salesPerson) queryParams.append('salesPerson', params.salesPerson)

    const url = queryParams.toString() 
      ? `${API_BASE_URL}?${queryParams.toString()}`
      : API_BASE_URL

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching sales orders:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single sales order
export const getSalesOrder = async (orderId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching sales order:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create sales order
export const createSalesOrder = async (orderData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating sales order:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update sales order
export const updateSalesOrder = async (orderId, orderData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating sales order:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete sales order
export const deleteSalesOrder = async (orderId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${orderId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting sales order:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
}
