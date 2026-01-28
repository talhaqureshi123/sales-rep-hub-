const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const { sendOrderApprovalEmail } = require('../utils/emailService');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}\n`),
  section: (msg) => console.log(`\n${colors.magenta}📋 ${msg}${colors.reset}`),
};

const testEmailSend = async () => {
  try {
    log.header('EMAIL SEND TEST - ORDER APPROVAL');

    // Connect to database
    await connectDB();
    log.success('Connected to database\n');

    // ============================================
    // STEP 1: CHECK EMAIL CONFIGURATION
    // ============================================
    log.section('STEP 1: Checking Email Configuration');

    // Read emailService.js to check if password is set
    const fs = require('fs');
    const path = require('path');
    const emailServicePath = path.join(__dirname, '../utils/emailService.js');
    const emailServiceContent = fs.readFileSync(emailServicePath, 'utf8');

    if (emailServiceContent.includes("'your-app-password-here'")) {
      log.error('Gmail App Password is still set to placeholder!');
      log.warning('Email will NOT be sent until you update the password.');
      console.log(`\n${colors.yellow}📝 To fix this:${colors.reset}`);
      console.log(`   1. Open: backend/utils/emailService.js`);
      console.log(`   2. Find line 287: APPROVAL_EMAIL_PASS = 'your-app-password-here'`);
      console.log(`   3. Replace with your actual Gmail App Password`);
      console.log(`\n${colors.cyan}💡 How to get Gmail App Password:${colors.reset}`);
      console.log(`   1. Go to Google Account → Security`);
      console.log(`   2. Enable 2-Step Verification`);
      console.log(`   3. Go to App passwords → Generate new app password`);
      console.log(`   4. Copy the 16-character password`);
      console.log(`   5. Paste it in emailService.js line 287\n`);
      
      log.warning('Continuing test anyway to show email flow...\n');
    } else {
      log.success('Gmail App Password appears to be configured');
    }

    // ============================================
    // STEP 2: GET TEST DATA
    // ============================================
    log.section('STEP 2: Getting Test Data');

    // Get latest approved order or create test data
    let testOrder = await SalesOrder.findOne({ 
      approvalStatus: 'Approved',
      orderStatus: 'Confirmed'
    })
    .populate('salesPerson', 'name email')
    .populate('customer', 'name firstName email phone')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 });

    if (!testOrder) {
      log.warning('No approved order found. Creating test order data...');
      
      const salesman = await User.findOne({ role: 'salesman' });
      const customer = await Customer.findOne();
      
      if (!salesman || !customer) {
        log.error('Need at least one salesman and customer to create test order');
        process.exit(1);
      }

      // Create mock order details for testing
      testOrder = {
        soNumber: 'SO-TEST-EMAIL',
        customerName: customer.firstName ? `${customer.firstName} ${customer.name || ''}`.trim() : customer.name || 'Test Customer',
        grandTotal: 1000.00,
        salesPerson: salesman,
        invoiceNumber: 'INV-TEST-EMAIL',
      };
      
      log.info('Using mock order data for email test');
    } else {
      log.success(`Found approved order: ${testOrder.soNumber}`);
    }

    // ============================================
    // STEP 3: PREPARE EMAIL DATA
    // ============================================
    log.section('STEP 3: Preparing Email Data');

    const orderDetails = {
      soNumber: testOrder.soNumber,
      customerName: testOrder.customerName,
      grandTotal: testOrder.grandTotal,
      salesPerson: testOrder.salesPerson,
      invoiceNumber: testOrder.invoiceNumber,
    };

    console.log(`   Order Number: ${orderDetails.soNumber}`);
    console.log(`   Customer: ${orderDetails.customerName}`);
    console.log(`   Amount: £${orderDetails.grandTotal.toFixed(2)}`);
    console.log(`   Sales Person: ${orderDetails.salesPerson?.name || orderDetails.salesPerson?.email || 'N/A'}`);
    console.log(`   Invoice: ${orderDetails.invoiceNumber || 'N/A'}`);

    const APPROVAL_EMAIL = 'talhaabid400@gmail.com';
    console.log(`\n   📧 Sending to: ${APPROVAL_EMAIL}`);

    // ============================================
    // STEP 4: SEND TEST EMAIL
    // ============================================
    log.section('STEP 4: Sending Test Email');

    log.info('Attempting to send email...');
    
    const result = await sendOrderApprovalEmail(APPROVAL_EMAIL, 'Admin', orderDetails);

    if (result.success) {
      log.success('Email sent successfully!');
      console.log(`   Message ID: ${result.messageId || 'N/A'}`);
      console.log(`   Sent to: ${APPROVAL_EMAIL}`);
      console.log(`\n${colors.green}✅ Check your inbox at ${APPROVAL_EMAIL}${colors.reset}`);
    } else {
      log.error('Email sending failed!');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
      
      if (result.error && result.error.includes('EAUTH')) {
        log.warning('\n🔐 Authentication Error Detected!');
        console.log(`\n${colors.yellow}This usually means:${colors.reset}`);
        console.log(`   1. Gmail App Password is incorrect`);
        console.log(`   2. 2-Step Verification is not enabled`);
        console.log(`   3. App Password has not been generated`);
        console.log(`\n${colors.cyan}Fix Steps:${colors.reset}`);
        console.log(`   1. Go to: https://myaccount.google.com/security`);
        console.log(`   2. Enable 2-Step Verification`);
        console.log(`   3. Go to App passwords`);
        console.log(`   4. Generate new app password for "Mail"`);
        console.log(`   5. Copy the 16-character password`);
        console.log(`   6. Update backend/utils/emailService.js line 287\n`);
      }
    }

    // ============================================
    // STEP 5: SUMMARY
    // ============================================
    log.section('STEP 5: Test Summary');

    if (result.success) {
      log.success('✅ Email test completed successfully!');
      console.log(`\n${colors.green}📧 Email should be in inbox: ${APPROVAL_EMAIL}${colors.reset}`);
      console.log(`   Subject: Sales Order Approved: ${orderDetails.soNumber}`);
    } else {
      log.error('❌ Email test failed!');
      console.log(`\n${colors.red}Please check:${colors.reset}`);
      console.log(`   1. Gmail App Password is set correctly`);
      console.log(`   2. 2-Step Verification is enabled`);
      console.log(`   3. App Password is generated`);
      console.log(`   4. Internet connection is working`);
    }

    log.header('TEST COMPLETED');

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    log.error('Error in email test:');
    console.error(error);
    console.error(error.stack);
    
    if (error.code === 'EAUTH') {
      log.warning('\n🔐 Authentication Error!');
      console.log(`\n${colors.yellow}Update Gmail App Password in:${colors.reset}`);
      console.log(`   backend/utils/emailService.js (line 287)\n`);
    }
    
    process.exit(1);
  }
};

// Run the test
if (require.main === module) {
  testEmailSend();
}

module.exports = testEmailSend;
