const crypto = require("crypto");
const User = require("../database/models/User");
const bcrypt = require("bcryptjs");
const { sendOTPEmail } = require("../utils/emailService");

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { token, otp } = req.body;

    if (!token || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide token and OTP",
      });
    }

    // Hash the token to compare with stored token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this token and check if token is not expired
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires +otp +otpExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Check if OTP matches and is not expired
    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // OTP verified successfully
    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error verifying OTP",
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Please provide token",
      });
    }

    // Hash the token to compare with stored token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save OTP to user
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(user.email, user.name, otp);
    if (!emailResult.success) {
      console.error("Failed to send OTP email:", emailResult.error);
    }

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
      data: {
        otpSent: emailResult.success,
        // Only send OTP in development mode for testing
        otp: process.env.NODE_ENV === "development" ? otp : undefined,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error resending OTP",
    });
  }
};

// @desc    Setup password using token from email (after OTP verification)
// @route   POST /api/auth/setup-password
// @access  Public
const setupPassword = async (req, res) => {
  try {
    const { token, password, phone, address, otp } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide token and password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Hash the token to compare with stored token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this token and check if token is not expired
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires +otp +otpExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // OTP verification is required
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required. Please verify OTP first.",
      });
    }

    // Verify OTP
    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please verify OTP again.",
      });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;

    // Update phone and address if provided
    if (phone) {
      user.phone = phone;
    }
    if (address) {
      user.address = address;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password and profile updated successfully. You can now login.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error setting password",
    });
  }
};

// @desc    Verify password setup token
// @route   GET /api/auth/verify-setup-token/:token
// @access  Public
const verifySetupToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Please provide token",
      });
    }

    // Hash the token to compare with stored token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this token and check if token is not expired
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("name email");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Generate and send OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save OTP to user
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(user.email, user.name, otp);
    if (!emailResult.success) {
      console.error("Failed to send OTP email:", emailResult.error);
      // Still return success, OTP is saved and can be shown in console
    }

    res.status(200).json({
      success: true,
      message: "Token is valid. OTP sent to your email.",
      data: {
        name: user.name,
        email: user.email,
        otpSent: emailResult.success,
        // Only send OTP in development mode for testing
        otp: process.env.NODE_ENV === "development" ? otp : undefined,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error verifying token",
    });
  }
};

module.exports = {
  setupPassword,
  verifySetupToken,
  verifyOTP,
  resendOTP,
};
