const User = require("../../database/models/User");
const crypto = require("crypto");
const { generatePasswordResetToken } = require("../../utils/jwt");
const { sendPasswordSetupEmail } = require("../../utils/emailService");

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    const filter = {};

    if (role) {
      filter.role = role;
    }
    if (status) {
      filter.status = status;
    }

    const users = await User.find(filter)
      .select("-password -passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching users",
    });
  }
};

// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching user",
    });
  }
};

// @desc    Create user
// @route   POST /api/admin/users
// @access  Private/Admin
const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      address,
      status,
      customerLimit,
    } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const userData = {
      name,
      email,
      role,
      phone,
      address,
      status: status || "Active",
    };

    let resetToken = null; // Declare resetToken in outer scope

    // For salesman, if no password provided, create account with password reset token
    if (role === "salesman" && !password) {
      // Generate password reset token
      const tokenData = generatePasswordResetToken();
      resetToken = tokenData.resetToken;
      userData.passwordResetToken = tokenData.hashedToken;
      userData.passwordResetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      // Set a temporary password (will be changed by user)
      userData.password = crypto.randomBytes(16).toString('hex');
    } else if (password) {
      // If password provided, use it
      userData.password = password;
    } else {
      // For admin, password is required
      return res.status(400).json({
        success: false,
        message: "Password is required for admin users",
      });
    }

    // Only add customerLimit for salesman
    if (role === "salesman" && customerLimit !== undefined) {
      userData.customerLimit = customerLimit;
    }

    const user = await User.create(userData);

    // If salesman created without password, send email
    if (role === "salesman" && !password && resetToken) {
      console.log('📧 Attempting to send password setup email to:', email);
      const emailResult = await sendPasswordSetupEmail(email, name, resetToken);
      if (!emailResult.success) {
        console.error('❌ Failed to send email:', emailResult.error);
        console.error('💡 Make sure EMAIL_USER and EMAIL_PASS are set in .env file');
        // Still return success, but log the error and include link in response
      } else {
        console.log('✅ Email sent successfully to:', email);
      }
    }

    // Prepare response message
    let responseMessage = "User created successfully";
    let emailSent = false;
    
    if (role === "salesman" && !password && resetToken) {
      const emailResult = await sendPasswordSetupEmail(email, name, resetToken);
      emailSent = emailResult.success;
      if (emailResult.success) {
        responseMessage = "Salesman created successfully. Password setup email sent.";
      } else {
        responseMessage = `Salesman created successfully, but email could not be sent. ${emailResult.error || 'Please check email configuration.'}`;
      }
    }

    res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        address: user.address,
        customerLimit: user.customerLimit,
        emailSent: emailSent,
        setupLink: role === "salesman" && !password && resetToken 
          ? `${require('../../enviornment/config').FRONTEND_URL}/setup-password?token=${resetToken}`
          : undefined,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error creating user",
    });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const { name, email, role, phone, address, status, customerLimit } =
      req.body;

    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (status) user.status = status;
    // Only update customerLimit for salesman
    if (user.role === "salesman" && customerLimit !== undefined) {
      user.customerLimit = customerLimit;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        address: user.address,
        customerLimit: user.customerLimit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error updating user",
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting user",
    });
  }
};

// @desc    Generate password setup link for user
// @route   POST /api/admin/users/:id/generate-password-link
// @access  Private/Admin
const generatePasswordLink = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate password reset token
    const { resetToken, hashedToken } = generatePasswordResetToken();
    
    // Update user with token
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Generate setup URL
    const config = require('../../enviornment/config');
    const setupUrl = `${config.FRONTEND_URL}/setup-password?token=${resetToken}`;

    // Send email with password setup link
    const { sendPasswordSetupEmail } = require('../../utils/emailService');
    const emailResult = await sendPasswordSetupEmail(user.email, user.name, resetToken);
    
    if (!emailResult.success) {
      console.error('Failed to send password setup email:', emailResult.error);
    }

    res.status(200).json({
      success: true,
      message: emailResult.success 
        ? "Password setup link generated and sent to email successfully"
        : "Password setup link generated. Email not sent (check email configuration).",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        setupUrl: setupUrl,
        expiresIn: "24 hours",
        emailSent: emailResult.success,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error generating password link",
    });
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  generatePasswordLink,
};
