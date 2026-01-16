const API_BASE_URL = '/api/admin/tracking'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all tracking sessions (shifts)
export const getAllTracking = async (filters = {}) => {
  try {
    const token = getAuthToken()
    
    const queryParams = new URLSearchParams()
    if (filters.salesman) queryParams.append('salesman', filters.salesman)
    if (filters.status) queryParams.append('status', filters.status)
    if (filters.date) queryParams.append('date', filters.date)
    if (filters.search) queryParams.append('search', filters.search)

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

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get tracking sessions')
    }

    return data
  } catch (error) {
    console.error('Error getting tracking sessions:', error)
    throw error
  }
}

// Get single tracking session
export const getTracking = async (id) => {
  try {
    const token = getAuthToken()
    
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get tracking session')
    }

    return data
  } catch (error) {
    console.error('Error getting tracking session:', error)
    throw error
  }
}

// Get all active tracking sessions for live tracking
export const getActiveTrackingSessions = async () => {
  try {
    const token = getAuthToken()
    
    const response = await fetch(`${API_BASE_URL}/active`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get active tracking sessions')
    }

    return data
  } catch (error) {
    console.error('Error getting active tracking sessions:', error)
    throw error
  }
}

export default {
  getAllTracking,
  getTracking,
  getActiveTrackingSessions,
}
