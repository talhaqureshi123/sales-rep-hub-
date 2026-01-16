// Login service function - Only uses backend API
export const loginService = async (email, password) => {
  try {
    // Call backend API for authentication
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Store login status and token
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userRole", data.data.user.role);
      localStorage.setItem("token", data.data.token);
      localStorage.setItem("userId", data.data.user.id || data.data.user._id);

      return {
        success: true,
        message: "Login successful",
        user: {
          email: email,
          role: data.data.user.role,
        },
      };
    } else {
      // Login failed - return error message from backend
      return {
        success: false,
        message: data.message || "Invalid email or password",
      };
    }
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      message:
        "Unable to connect to server. Please make sure the backend server is running.",
    };
  }
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return localStorage.getItem("isAuthenticated") === "true";
};

// Logout function
export const logoutService = () => {
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userRole");
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
};
