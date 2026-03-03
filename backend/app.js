const express = require("express");
const path = require("path");
const fs = require("fs");
const connectDB = require("./database/connection");
const errorHandler = require("./middleware/errorHandler");
const config = require("./config");
const Tracking = require("./database/models/Tracking");
const VisitTarget = require("./database/models/VisitTarget");

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

// Shift photos: absolute path so VM/Hostinger uses correct folder (no cwd dependency)
const shiftPhotosDir = path.resolve(__dirname, "shift-photos");
if (!fs.existsSync(shiftPhotosDir)) fs.mkdirSync(shiftPhotosDir, { recursive: true });

// Shift photos: serve from folder first; if file missing (e.g. VM), fallback to DB base64 so admin Shift Photos still works.
app.get("/api/shift-photos/files/:id/:filename", async (req, res) => {
  const { id, filename } = req.params;
  if ([id, filename].some((p) => p.includes("..") || p.includes(path.sep))) {
    return res.status(400).send("Invalid path");
  }
  const safePath = path.join(shiftPhotosDir, id, filename);
  if (fs.existsSync(safePath)) {
    res.setHeader("Content-Type", "image/jpeg");
    return res.sendFile(safePath);
  }
  const isBase64 = (v) => typeof v === "string" && v && !v.startsWith("/") && !v.startsWith("http");
  if (id.startsWith("visit-")) {
    const visitId = id.replace("visit-", "");
    const visit = await VisitTarget.findById(visitId).select("visitedAreaImage visitedAreaImages").lean();
    if (visit) {
      const idx = filename.match(/visited_(\d+)\.jpg/);
      const arr = Array.isArray(visit.visitedAreaImages) ? visit.visitedAreaImages : (visit.visitedAreaImage ? [visit.visitedAreaImage] : []);
      const img = idx ? arr[Number(idx[1])] : arr[0];
      if (img && isBase64(img)) {
        const buf = Buffer.from(img.startsWith("data:") ? img.split(",")[1] : img, "base64");
        res.setHeader("Content-Type", "image/jpeg");
        return res.send(buf);
      }
    }
  } else {
    const tracking = await Tracking.findById(id).select("speedometerImage endingMeterImage visitedAreaImage").lean();
    if (tracking) {
      let img;
      if (filename === "start.jpg") img = tracking.speedometerImage;
      else if (filename === "end.jpg") img = tracking.endingMeterImage;
      else if (filename.startsWith("visited")) img = tracking.visitedAreaImage;
      if (img && isBase64(img)) {
        const buf = Buffer.from(img.startsWith("data:") ? img.split(",")[1] : img, "base64");
        res.setHeader("Content-Type", "image/jpeg");
        return res.send(buf);
      }
    }
  }
  res.status(404).send("Not found");
});

app.use("/api/shift-photos/files", express.static(shiftPhotosDir));

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
    message: "Praco Supplies API",
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

