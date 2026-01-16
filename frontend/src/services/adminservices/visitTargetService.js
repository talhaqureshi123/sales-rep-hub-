// Admin Visit Target Service - Handles visit target management via backend API

const API_BASE_URL = '/api/admin/visit-targets'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all visit targets
export const getVisitTargets = async (params = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    // Build query string
    const queryParams = new URLSearchParams()
    if (params.salesman) queryParams.append('salesman', params.salesman)
    if (params.status) queryParams.append('status', params.status)
    if (params.priority) queryParams.append('priority', params.priority)
    if (params.approvalStatus) queryParams.append('approvalStatus', params.approvalStatus)
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

// Create visit target
export const createVisitTarget = async (visitTargetData) => {
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
      body: JSON.stringify(visitTargetData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating visit target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update visit target
export const updateVisitTarget = async (id, visitTargetData) => {
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
      body: JSON.stringify(visitTargetData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating visit target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete visit target
export const deleteVisitTarget = async (id) => {
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
    console.error('Error deleting visit target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get visit targets by salesman
export const getVisitTargetsBySalesman = async (salesmanId) => {
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
    console.error('Error fetching visit targets by salesman:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get salesman target statistics
export const getSalesmanTargetStats = async (salesmanId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/salesman/${salesmanId}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to fetch salesman target stats' }
    }

    return { success: true, data: data.data }
  } catch (error) {
    console.error('Error fetching salesman target stats:', error)
    return { success: false, message: error.message || 'Failed to fetch salesman target stats' }
  }
}

export default {
  getVisitTargets,
  getVisitTarget,
  createVisitTarget,
  updateVisitTarget,
  deleteVisitTarget,
  getVisitTargetsBySalesman,
  getSalesmanTargetStats,
}

