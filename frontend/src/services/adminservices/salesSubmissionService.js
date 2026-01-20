// Admin Sales Submission Service

const API_BASE_URL = '/api/admin/sales-submissions'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all sales submissions
export const getSalesSubmissions = async (params = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (params.salesman) queryParams.append('salesman', params.salesman)
    if (params.status) queryParams.append('status', params.status)
    if (params.fromDate) queryParams.append('fromDate', params.fromDate)
    if (params.toDate) queryParams.append('toDate', params.toDate)
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
    console.error('Error fetching sales submissions:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single sales submission
export const getSalesSubmission = async (submissionId) => {
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

// Approve sales submission
export const approveSalesSubmission = async (submissionId, adminNotes = '') => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${submissionId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ adminNotes }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error approving sales submission:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Reject sales submission
export const rejectSalesSubmission = async (submissionId, rejectionReason, adminNotes = '') => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${submissionId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ rejectionReason, adminNotes }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error rejecting sales submission:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get sales submission statistics
export const getSalesSubmissionStats = async () => {
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
