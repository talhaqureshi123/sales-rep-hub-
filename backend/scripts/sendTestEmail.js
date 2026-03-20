require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const config = require('../config');
const { sendPasswordSetupEmail } = require('../utils/emailService');

const testEmail = async () => {
  console.log('\n📧 Sending Test Email...\n');
  
  const testToken = 'test-token-12345';
  const testEmail = (config.ORDER_NOTIFY_EMAIL && config.ORDER_NOTIFY_EMAIL.trim()) || 'accounts@praco.co.uk';
  const testName = 'Test User';
  
  try {
    const result = await sendPasswordSetupEmail(testEmail, testName, testToken);
    
    if (result.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📬 Check inbox:', testEmail);
      console.log('📬 Check spam folder too!');
    } else {
      console.error('❌ Failed to send test email:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
};

testEmail();
