// Admin Dashboard Service - Single fast API for dashboard overview

const API_BASE_URL = '/api/admin/dashboard'

const getAuthToken = () => localStorage.getItem('token')

/**
 * Get dashboard summary (counts, today schedule, recent activity, charts, my creations).
 * One API call instead of 5 - much faster load.
 */
export const getAdminDashboard = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(API_BASE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status === 401) {
      localStorage.clear()
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching admin dashboard:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
