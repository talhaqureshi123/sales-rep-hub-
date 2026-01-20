// Salesman Sales Target Service

const API_BASE_URL = '/api/salesman/sales-targets'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all my sales targets
export const getMySalesTargets = async (filters = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (filters.status) queryParams.append('status', filters.status)
    if (filters.period) queryParams.append('period', filters.period)
    if (filters.targetType) queryParams.append('targetType', filters.targetType)

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
export const getMySalesTarget = async (targetId) => {
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

// Get sales target statistics
export const getMySalesTargetStats = async () => {
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
    console.error('Error fetching sales target stats:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
