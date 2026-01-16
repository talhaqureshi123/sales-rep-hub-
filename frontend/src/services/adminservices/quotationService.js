const API_BASE_URL = '/api/admin/quotations'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all quotations
export const getQuotations = async (filters = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (filters.salesman) queryParams.append('salesman', filters.salesman)
    if (filters.status) queryParams.append('status', filters.status)
    if (filters.search) queryParams.append('search', filters.search)
    if (filters.startDate) queryParams.append('startDate', filters.startDate)
    if (filters.endDate) queryParams.append('endDate', filters.endDate)

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
    console.error('Error fetching quotations:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single quotation
export const getQuotation = async (quotationId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${quotationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching quotation:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update quotation
export const updateQuotation = async (quotationId, quotationData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${quotationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(quotationData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating quotation:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete quotation
export const deleteQuotation = async (quotationId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${quotationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting quotation:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create quotation
export const createQuotation = async (quotationData) => {
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
      body: JSON.stringify(quotationData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating quotation:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get quotation statistics
export const getQuotationStats = async () => {
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
    console.error('Error fetching quotation stats:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
