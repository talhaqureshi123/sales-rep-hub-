const express = require("express");
const router = express.Router();
const { register, login, getMe } = require("./authController");
const {
  setupPassword,
  verifySetupToken,
  verifyOTP,
  resendOTP,
} = require("./passwordController");
const { protect, authorize } = require("../middleware/auth");

router.post("/register", protect, authorize("admin"), register);
router.post("/login", login);
router.post("/setup-password", setupPassword);
router.get("/verify-setup-token/:token", verifySetupToken);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.get("/me", protect, getMe);

module.exports = router;
