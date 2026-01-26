const User = require("../database/models/User");
const { generateToken } = require("../utils/jwt");

// @desc    Register new user (Admin only)
// @route   POST /api/auth/register
// @access  Private/Admin
const register = async (req, res) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      address,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error registering user",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select("+password +passwordResetToken +passwordResetExpires");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (user.status !== "Active") {
      return res.status(401).json({
        success: false,
        message: "Your account is inactive. Please contact administrator.",
      });
    }

    // Check if user has password reset token (password not set yet)
    if (user.passwordResetToken && user.passwordResetExpires > Date.now()) {
      return res.status(401).json({
        success: false,
        message: "Please set your password first. Check your email for the setup link.",
      });
    }

    // Check if password exists
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Password not set. Please contact administrator.",
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update lastActivity for online status tracking
    user.lastActivity = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error logging in",
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        address: user.address,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error getting user",
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
};

