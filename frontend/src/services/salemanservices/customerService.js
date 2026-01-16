// Salesman Customer Service - Handles customer management via backend API

const API_BASE_URL = '/api/salesman/customers'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all customers assigned to logged-in salesman
export const getMyCustomers = async (params = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    // Build query string
    const queryParams = new URLSearchParams()
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

export default {
  getMyCustomers,
  getCustomer,
  createCustomer,
}


