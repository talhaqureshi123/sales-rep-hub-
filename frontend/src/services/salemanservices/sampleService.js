// Salesman Sample Service
const API_BASE_URL = '/api/salesman/samples'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all samples for logged-in salesman
export const getMySamples = async (filters = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (filters.status) queryParams.append('status', filters.status)
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
    console.error('Error fetching samples:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single sample
export const getSample = async (sampleId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${sampleId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching sample:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create sample
export const createSample = async (sampleData) => {
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
      body: JSON.stringify(sampleData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating sample:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update sample
export const updateSample = async (sampleId, sampleData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${sampleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(sampleData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating sample:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
