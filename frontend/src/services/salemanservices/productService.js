// Salesman Product Service - Handles product fetching via backend API

const API_BASE_URL = "/api/salesman/products";

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Get all products (for salesman)
export const getProducts = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Authentication token not found." };
    }

    const response = await fetch(API_BASE_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token')
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      window.location.href = '/'
      return { success: false, data: [], message: 'Session expired. Please login again.' }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching products:", error);
    return { success: false, message: "Network error or server is down." };
  }
};

// Get product by code (for QR scanning)
export const getProductByCode = async (productCode) => {
  try {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Authentication token not found." };
    }

    const response = await fetch(`${API_BASE_URL}/code/${productCode}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching product by code:", error);
    return { success: false, message: "Network error or server is down." };
  }
};

// Local storage functions for scanned products (temporary storage)
const SCANNED_PRODUCTS_KEY = "scannedProducts";

export const addScannedProduct = (product) => {
  try {
    const existing = getScannedProducts();
    // Check if product already exists
    const exists = existing.find((p) => p.productCode === product.productCode);
    if (!exists) {
      const updated = [
        ...existing,
        { ...product, scannedAt: new Date().toISOString() },
      ];
      localStorage.setItem(SCANNED_PRODUCTS_KEY, JSON.stringify(updated));
    }
  } catch (error) {
    console.error("Error adding scanned product:", error);
  }
};

export const getScannedProducts = () => {
  try {
    const stored = localStorage.getItem(SCANNED_PRODUCTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error getting scanned products:", error);
    return [];
  }
};

export const removeScannedProduct = (productCode) => {
  try {
    const existing = getScannedProducts();
    const updated = existing.filter((p) => p.productCode !== productCode);
    localStorage.setItem(SCANNED_PRODUCTS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error removing scanned product:", error);
  }
};

export const clearScannedProducts = () => {
  try {
    localStorage.removeItem(SCANNED_PRODUCTS_KEY);
  } catch (error) {
    console.error("Error clearing scanned products:", error);
  }
};

export default {
  getProducts,
  getProductByCode,
  addScannedProduct,
  getScannedProducts,
  removeScannedProduct,
  clearScannedProducts,
};
