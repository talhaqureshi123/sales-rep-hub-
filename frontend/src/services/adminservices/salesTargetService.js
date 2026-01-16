const API_BASE_URL = '/api/admin/sales-targets'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all sales targets
export const getSalesTargets = async (filters = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (filters.salesman) queryParams.append('salesman', filters.salesman)
    if (filters.status) queryParams.append('status', filters.status)
    if (filters.period) queryParams.append('period', filters.period)
    if (filters.fromDate) queryParams.append('fromDate', filters.fromDate)
    if (filters.toDate) queryParams.append('toDate', filters.toDate)
    if (filters.search) queryParams.append('search', filters.search)

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
    console.error('Error fetching sales targets:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single sales target
export const getSalesTarget = async (targetId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${targetId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching sales target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create sales target
export const createSalesTarget = async (targetData) => {
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
      body: JSON.stringify(targetData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating sales target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update sales target
export const updateSalesTarget = async (targetId, targetData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${targetId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(targetData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating sales target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete sales target
export const deleteSalesTarget = async (targetId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${targetId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting sales target:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
