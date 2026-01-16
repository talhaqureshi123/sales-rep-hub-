const API_BASE_URL = '/api/admin/follow-ups'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all follow-ups
export const getFollowUps = async (filters = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (filters.salesman) queryParams.append('salesman', filters.salesman)
    if (filters.status) queryParams.append('status', filters.status)
    if (filters.type) queryParams.append('type', filters.type)
    if (filters.priority) queryParams.append('priority', filters.priority)
    if (filters.search) queryParams.append('search', filters.search)
    if (filters.startDate) queryParams.append('startDate', filters.startDate)
    if (filters.endDate) queryParams.append('endDate', filters.endDate)
    if (filters.source) queryParams.append('source', filters.source)

    const url = queryParams.toString() ? `${API_BASE_URL}?${queryParams.toString()}` : API_BASE_URL

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
    console.error('Error fetching follow-ups:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single follow-up
export const getFollowUp = async (followUpId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${followUpId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching follow-up:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create follow-up
export const createFollowUp = async (followUpData) => {
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
      body: JSON.stringify(followUpData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating follow-up:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update follow-up
export const updateFollowUp = async (followUpId, followUpData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${followUpId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(followUpData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating follow-up:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete follow-up
export const deleteFollowUp = async (followUpId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${followUpId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting follow-up:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get follow-up statistics
export const getFollowUpStats = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching follow-up stats:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
