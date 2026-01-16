const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const User = require('../database/models/User');
const crypto = require('crypto');
const config = require('../enviornment/config');

// Get command line arguments
const args = process.argv.slice(2);
const email = args[0]; // Email address

if (!email) {
  console.log('❌ Error: Please provide email address');
  console.log('\nUsage:');
  console.log('  node scripts/generatePasswordLink.js <email>');
  console.log('\nExample:');
  console.log('  node scripts/generatePasswordLink.js usman.abid00321@gmail.com');
  process.exit(1);
}

const generatePasswordLink = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      process.exit(1);
    }

    if (user.role !== 'salesman') {
      console.log(`⚠️  Warning: User ${email} is not a salesman (Role: ${user.role})`);
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Update user with token
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Generate setup URL
    const setupUrl = `${config.FRONTEND_URL}/setup-password?token=${resetToken}`;

    console.log(`✅ Password setup link generated for: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`\n🔗 Password Setup Link:`);
    console.log(`   ${setupUrl}`);
    console.log(`\n⏰ Link expires in 24 hours`);
    console.log(`\n📋 Instructions:`);
    console.log(`   1. Copy the link above`);
    console.log(`   2. Send it to ${user.name} (${user.email})`);
    console.log(`   3. User will set their password using this link`);
    console.log(`   4. After setting password, user can login normally`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating password link:', error.message);
    process.exit(1);
  }
};

// Run the function
generatePasswordLink();
