const express = require("express");
const router = express.Router();
const { getLatestSalesmenLocations } = require("../controllers/locationController");
const { protect, authorize } = require("../../middleware/auth");

// All routes require authentication and admin role
router.use(protect);
router.use(authorize("admin"));

router.get("/latest", getLatestSalesmenLocations);

module.exports = router;

