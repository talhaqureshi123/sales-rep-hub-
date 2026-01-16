const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE,
  });
};

// Verify JWT Token
const verifyToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET);
};

// Generate Password Reset Token
const generatePasswordResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  return { resetToken, hashedToken };
};

module.exports = {
  generateToken,
  verifyToken,
  generatePasswordResetToken,
};


