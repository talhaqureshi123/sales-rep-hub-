const express = require("express");
const connectDB = require("./database/connection");
const errorHandler = require("./middleware/errorHandler");
const config = require("./enviornment/config");

// Import routes
const authRoutes = require("./authentication/authRoutes");
const adminRoutes = require("./admin/index");
const salesmanRoutes = require("./salesman/index");
const hubspotOAuthRoutes = require("./hubspot/oauthRoutes");

// Connect to database
connectDB();

// Initialize app
const app = express();

// Body parser middleware - Increase limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS middleware (for frontend connection)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/salesman", salesmanRoutes);
app.use("/api/hubspot", hubspotOAuthRoutes);

// Debug: Log all admin routes
app.use("/api/admin", (req, res, next) => {
  console.log(`[ADMIN ROUTE] ${req.method} ${req.path}`);
  next();
});

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Sales Rap Hub API",
    version: "1.0.0",
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

module.exports = app;

