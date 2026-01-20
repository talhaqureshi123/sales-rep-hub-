// Salesman Sales Submission Service

const API_BASE_URL = '/api/salesman/sales-submissions'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all my sales submissions
export const getMySalesSubmissions = async (filters = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (filters.status) queryParams.append('status', filters.status)
    if (filters.fromDate) queryParams.append('fromDate', filters.fromDate)
    if (filters.toDate) queryParams.append('toDate', filters.toDate)

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
    console.error('Error fetching sales submissions:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single sales submission
export const getMySalesSubmission = async (submissionId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${submissionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching sales submission:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create sales submission
export const createSalesSubmission = async (submissionData) => {
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
      body: JSON.stringify(submissionData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating sales submission:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update sales submission
export const updateSalesSubmission = async (submissionId, submissionData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${submissionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(submissionData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating sales submission:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete sales submission
export const deleteSalesSubmission = async (submissionId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${submissionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting sales submission:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get sales submission statistics
export const getMySalesSubmissionStats = async () => {
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
    console.error('Error fetching sales submission stats:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
