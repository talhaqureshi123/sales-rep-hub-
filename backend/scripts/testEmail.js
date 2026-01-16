require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');
const config = require('../enviornment/config');

console.log('\n📧 Email Configuration Test\n');
console.log('EMAIL_HOST:', config.EMAIL_HOST);
console.log('EMAIL_PORT:', config.EMAIL_PORT);
console.log('EMAIL_USER:', config.EMAIL_USER);
console.log('EMAIL_PASS:', config.EMAIL_PASS ? `SET (${config.EMAIL_PASS.length} characters)` : 'NOT SET');
console.log('EMAIL_PASS (first 4 chars):', config.EMAIL_PASS ? config.EMAIL_PASS.substring(0, 4) + '****' : 'N/A');
console.log('EMAIL_PASS (has spaces):', config.EMAIL_PASS ? (config.EMAIL_PASS.includes(' ') ? 'YES ❌' : 'NO ✅') : 'N/A');

if (!config.EMAIL_USER || !config.EMAIL_PASS) {
  console.error('\n❌ ERROR: EMAIL_USER or EMAIL_PASS not set in .env file');
  process.exit(1);
}

// Remove spaces from password
const cleanPassword = config.EMAIL_PASS.replace(/\s/g, '');
console.log('\n🧹 Cleaned Password Length:', cleanPassword.length);
console.log('🧹 Cleaned Password (first 4 chars):', cleanPassword.substring(0, 4) + '****');

console.log('\n🔐 Testing Gmail Authentication...\n');

const transporter = nodemailer.createTransport({
  host: config.EMAIL_HOST,
  port: config.EMAIL_PORT,
  secure: false,
  auth: {
    user: config.EMAIL_USER,
    pass: cleanPassword,
  },
  debug: true,
  logger: true,
});

// Test connection
transporter.verify((error, success) => {
  if (error) {
    console.error('\n❌ Authentication FAILED!');
    console.error('Error:', error.message);
    
    if (error.message.includes('535') || error.message.includes('BadCredentials')) {
      console.error('\n💡 Possible Issues:');
      console.error('1. ❌ App Password is incorrect');
      console.error('2. ❌ 2-Step Verification is NOT enabled');
      console.error('3. ❌ Using regular password instead of App Password');
      console.error('4. ❌ App Password was revoked or expired');
      console.error('\n📋 Steps to Fix:');
      console.error('1. Go to: https://myaccount.google.com/security');
      console.error('2. Enable "2-Step Verification"');
      console.error('3. Go to: https://myaccount.google.com/apppasswords');
      console.error('4. Generate NEW App Password for "Mail"');
      console.error('5. Copy the 16-character password (NO SPACES)');
      console.error('6. Update .env file: EMAIL_PASS=your16charpassword');
      console.error('7. Restart backend server');
    }
    process.exit(1);
  } else {
    console.log('\n✅ Authentication SUCCESSFUL!');
    console.log('✅ Gmail SMTP connection verified');
    console.log('\n📧 You can now send emails!');
    process.exit(0);
  }
});
