const API_BASE_URL = '/api';

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

/**
 * Get dashboard stats for logged-in salesman
 * @returns {Promise<Object>} Dashboard stats including KPIs, charts, schedule
 */
export const getDashboardStats = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: 'Authentication token not found. Please login.',
      };
    }

    const response = await fetch(`${API_BASE_URL}/salesman/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch dashboard stats',
      };
    }

    return data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      success: false,
      message: 'Network error or server is down.',
    };
  }
};

export default {
  getDashboardStats,
};

