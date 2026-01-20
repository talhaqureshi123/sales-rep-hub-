const express = require("express");
const router = express.Router();
const productRoutes = require("./routes/productRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
// const milestoneRoutes = require("./routes/milestoneRoutes"); // COMMENTED OUT
const visitTargetRoutes = require("./routes/visitTargetRoutes");
const customerRoutes = require("./routes/customerRoutes");
const achievementRoutes = require("./routes/achievementRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const locationRoutes = require("./routes/locationRoutes");
const trackingRoutes = require("./routes/trackingRoutes");
const sampleRoutes = require("./routes/sampleRoutes");
const followUpRoutes = require("./routes/followUpRoutes");
const salesTargetRoutes = require("./routes/salesTargetRoutes");
const salesSubmissionRoutes = require("./routes/salesSubmissionRoutes");

// Mount routes
router.use("/products", productRoutes);
router.use("/quotations", quotationRoutes);
// router.use("/milestones", milestoneRoutes); // COMMENTED OUT
router.use("/visit-targets", visitTargetRoutes);
router.use("/customers", customerRoutes);
router.use("/achievements", achievementRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/location", locationRoutes);
router.use("/tracking", trackingRoutes);
router.use("/samples", sampleRoutes);
router.use("/follow-ups", followUpRoutes);
router.use("/sales-targets", salesTargetRoutes);
router.use("/sales-submissions", salesSubmissionRoutes);

module.exports = router;
