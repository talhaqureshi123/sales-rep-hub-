const API_BASE_URL = "/api";

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem("token");
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
        message: "Authentication token not found. Please login.",
      };
    }

    const response = await fetch(`${API_BASE_URL}/salesman/dashboard`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      return {
        success: false,
        message: response.ok
          ? "Invalid response."
          : response.status === 500
          ? "Server error. Please try again."
          : `Error ${response.status}`,
      };
    }
    if (!response.ok) {
      return {
        success: false,
        message:
          data.message ||
          (response.status === 500
            ? "Server error. Please try again."
            : "Failed to fetch dashboard stats"),
      };
    }
    return data;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      success: false,
      message: "Network error or server is down.",
    };
  }
};

export default {
  getDashboardStats,
};
