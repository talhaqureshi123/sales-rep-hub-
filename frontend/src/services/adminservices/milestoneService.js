// Admin Milestone Service - Handles milestone/visit management via backend API

const API_BASE_URL = '/api/admin/milestones'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all milestones (admin can see all)
export const getAllMilestones = async (salesmanId = null, status = null) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    let url = API_BASE_URL
    const params = new URLSearchParams()
    if (salesmanId) params.append('salesman', salesmanId)
    if (status) params.append('status', status)
    if (params.toString()) url += `?${params.toString()}`

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
    console.error('Error fetching milestones:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create milestone and assign to salesman
export const createMilestone = async (milestoneData) => {
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
      body: JSON.stringify(milestoneData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating milestone:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update milestone
export const updateMilestone = async (milestoneId, milestoneData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${milestoneId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(milestoneData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating milestone:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete milestone
export const deleteMilestone = async (milestoneId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${milestoneId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting milestone:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get all salesmen
export const getSalesmen = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/salesmen`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching salesmen:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getAllMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getSalesmen,
}

