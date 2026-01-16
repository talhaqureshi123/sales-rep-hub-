// Admin Customer Service - Handles customer management via backend API

const API_BASE_URL = '/api/admin/customers'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all customers
export const getCustomers = async (params = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    // Build query string
    const queryParams = new URLSearchParams()
    if (params.salesman) queryParams.append('salesman', params.salesman)
    if (params.status) queryParams.append('status', params.status)
    if (params.search) queryParams.append('search', params.search)

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
    console.error('Error fetching customers:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single customer
export const getCustomer = async (id) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching customer:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create customer
export const createCustomer = async (customerData) => {
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
      body: JSON.stringify(customerData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating customer:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update customer
export const updateCustomer = async (id, customerData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(customerData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating customer:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete customer
export const deleteCustomer = async (id) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting customer:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get customers by salesman
export const getCustomersBySalesman = async (salesmanId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/salesman/${salesmanId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching customers by salesman:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomersBySalesman,
}


