// Admin User Service - Handles user management via backend API

const API_BASE_URL = '/api/admin/users'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all users (optionally filter by role, status, or filters object)
export const getUsers = async (filters = null) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    // Build query string from filters
    let url = API_BASE_URL
    const params = new URLSearchParams()
    
    if (filters) {
      // If filters is an object, add all properties
      if (typeof filters === 'object') {
        if (filters.role) params.append('role', filters.role)
        if (filters.status) params.append('status', filters.status)
      } 
      // If filters is a string (backward compatibility), treat as role
      else if (typeof filters === 'string') {
        params.append('role', filters)
      }
    }

    // Add query string if params exist
    if (params.toString()) {
      url += `?${params.toString()}`
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      // Clear localStorage and reload page to force login
      localStorage.clear()
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching users:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create user
export const createUser = async (userData) => {
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
      body: JSON.stringify(userData),
    })

    // Handle 401 Unauthorized
    if (response.status === 401) {
      localStorage.clear()
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating user:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update user
export const updateUser = async (userId, userData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    })

    // Handle 401 Unauthorized
    if (response.status === 401) {
      localStorage.clear()
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating user:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete user
export const deleteUser = async (userId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    // Handle 401 Unauthorized
    if (response.status === 401) {
      localStorage.clear()
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting user:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Generate password setup link for user
export const generatePasswordLink = async (userId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${userId}/generate-password-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    // Handle 401 Unauthorized
    if (response.status === 401) {
      localStorage.clear()
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error generating password link:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  generatePasswordLink,
}

