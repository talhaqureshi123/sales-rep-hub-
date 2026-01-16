const express = require("express");
const router = express.Router();
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const customerRoutes = require("./routes/customerRoutes");
// const milestoneRoutes = require("./routes/milestoneRoutes"); // COMMENTED OUT
const visitTargetRoutes = require("./routes/visitTargetRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const sampleRoutes = require("./routes/sampleRoutes");
const followUpRoutes = require("./routes/followUpRoutes");
const productVideoRoutes = require("./routes/productVideoRoutes");
const salesOrderRoutes = require("./routes/salesOrderRoutes");
const salesTargetRoutes = require("./routes/salesTargetRoutes");
const shiftPhotoRoutes = require("./routes/shiftPhotoRoutes");
const trackingRoutes = require("./routes/trackingRoutes");
const hubspotRoutes = require("./routes/hubspotRoutes");

// Mount routes
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/customers", customerRoutes);
// router.use("/milestones", milestoneRoutes); // COMMENTED OUT
router.use("/visit-targets", visitTargetRoutes);
router.use("/quotations", quotationRoutes);
router.use("/samples", sampleRoutes);
router.use("/follow-ups", followUpRoutes);
router.use("/product-videos", productVideoRoutes);
router.use("/sales-orders", salesOrderRoutes);
router.use("/sales-targets", salesTargetRoutes);
router.use("/shift-photos", shiftPhotoRoutes);
router.use("/tracking", trackingRoutes);
router.use("/hubspot", hubspotRoutes);

module.exports = router;
