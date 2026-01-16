// Salesman Visit Target Service - Handles visit target fetching via backend API

const API_BASE_URL = '/api/salesman/visit-targets'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all visit targets assigned to salesman
export const getVisitTargets = async (params = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    // Build query string
    const queryParams = new URLSearchParams()
    if (params.status) queryParams.append('status', params.status)
    if (params.priority) queryParams.append('priority', params.priority)

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
    console.error('Error fetching visit targets:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single visit target
export const getVisitTarget = async (id) => {
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
    console.error('Error fetching visit target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update visit target status
export const updateVisitTargetStatus = async (id, statusData) => {
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
      body: JSON.stringify(statusData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating visit target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Check proximity to visit target
export const checkProximity = async (id, location) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${id}/check-proximity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(location),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error checking proximity:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Salesman creates a visit request (admin approval required)
export const createVisitRequest = async (requestData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating visit request:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Salesman can view their pending/rejected requests
export const getVisitRequests = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching visit requests:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getVisitTargets,
  getVisitTarget,
  updateVisitTargetStatus,
  checkProximity,
  createVisitRequest,
  getVisitRequests,
}

