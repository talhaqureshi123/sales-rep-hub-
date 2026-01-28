const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');
const { sendOrderApprovalEmail } = require('../utils/emailService');

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

const testSalesOrderEmail = async () => {
  try {
    log.header('SALES ORDER EMAIL TEST - ADMIN NOTIFICATION');

    // Connect to database
    await connectDB();
    log.success('Connected to database\n');

    // ============================================
    // STEP 1: CHECK EMAIL CONFIGURATION
    // ============================================
    log.section('STEP 1: Checking Email Configuration');

    const config = require('../config');
    const hasEnvPass = config.EMAIL_PASS && config.EMAIL_PASS.trim() && config.EMAIL_PASS !== 'your-app-password-here';
    const hasEnvUser = config.EMAIL_USER && config.EMAIL_USER.trim();

    if (hasEnvUser && hasEnvPass) {
      log.success('Email config from .env: EMAIL_USER and EMAIL_PASS are set');
      console.log(`   EMAIL_USER: ${config.EMAIL_USER}`);
      console.log(`   EMAIL_PASS: ${config.EMAIL_PASS ? '***' + config.EMAIL_PASS.slice(-4) : 'NOT SET'}\n`);
    } else {
      log.warning('EMAIL_USER or EMAIL_PASS not set in backend/.env');
      console.log(`\n${colors.yellow}📝 To fix: Add to backend/.env${colors.reset}`);
      console.log(`   EMAIL_USER=talhaabid400@gmail.com`);
      console.log(`   EMAIL_PASS=your-16-char-gmail-app-password`);
      console.log(`\n${colors.cyan}💡 Gmail App Password: Google Account → Security → 2-Step Verification → App passwords\n`);
      if (!hasEnvPass) {
        log.warning('Continuing test anyway...\n');
      }
    }

    // ============================================
    // STEP 2: GET TEST DATA
    // ============================================
    log.section('STEP 2: Getting Test Data');

    const salesman = await User.findOne({ role: 'salesman' });
    if (!salesman) {
      log.error('No salesman found. Please create at least one salesman first.');
      process.exit(1);
    }
    log.info(`Using Salesman: ${salesman.name} (${salesman.email})`);

    const customer = await Customer.findOne();
    if (!customer) {
      log.error('No customer found. Please create at least one customer first.');
      process.exit(1);
    }
    const customerName = customer.firstName 
      ? `${customer.firstName}${customer.name ? ' ' + customer.name : ''}`.trim()
      : customer.name || 'Unknown Customer';
    log.info(`Using Customer: ${customerName} (${customer.email || 'No email'})`);

    const product = await Product.findOne();
    if (!product) {
      log.error('No product found. Please create at least one product first.');
      process.exit(1);
    }
    log.info(`Using Product: ${product.name} - £${(product.price || 0).toFixed(2)}`);

    // ============================================
    // STEP 3: CREATE TEST ORDER
    // ============================================
    log.section('STEP 3: Creating Test Sales Order');

    // Generate unique SO number
    let soNumber;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const prefix = 'SO';
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      soNumber = `${prefix}${randomNum}`;
      const exists = await SalesOrder.findOne({ soNumber });
      if (!exists) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      log.error(`Failed to generate unique SO number after ${attempts} attempts`);
      process.exit(1);
    }

    // Generate invoice number
    let invoiceNumber;
    isUnique = false;
    attempts = 0;
    while (!isUnique && attempts < 10) {
      const prefix = 'INV';
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      invoiceNumber = `${prefix}-${randomNum}`;
      const exists = await SalesOrder.findOne({ invoiceNumber });
      if (!exists) {
        isUnique = true;
      }
      attempts++;
    }

    // Create order items
    const items = [{
      productCode: product.productCode || 'PROD001',
      productName: product.name,
      productId: product._id,
      spec: product.spec || 'Standard specification',
      unitPrice: product.price || 50.00,
      quantity: 2,
      unit: 'Rolls',
      lineTotal: (product.price || 50.00) * 2,
    }];

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const discount = 0;
    const deliveryCharges = 10.00;
    const vatRate = 20;
    const vat = parseFloat(((subtotal - discount + deliveryCharges) * (vatRate / 100)).toFixed(2));
    const grandTotal = parseFloat((subtotal - discount + deliveryCharges + vat).toFixed(2));

    // Build addresses
    const billingAddress = customer.address 
      ? `${customer.address}, ${customer.city || ''}, ${customer.state || ''}, ${customer.postcode || customer.pincode || ''}`.trim()
      : 'Address not provided';
    
    const deliveryAddress = billingAddress;

    // Create order data - BY DEFAULT APPROVED
    const orderDate = new Date();
    orderDate.setHours(12, 0, 0, 0);

    const orderData = {
      soNumber: soNumber,
      orderDate: orderDate,
      salesPerson: salesman._id,
      salesPersonEmail: salesman.email,
      poNumber: `PO-${Math.floor(Math.random() * 10000)}`,
      orderSource: 'Email Test Script',

      customer: customer._id,
      customerName: customerName,
      contactPerson: customer.contactPerson || customerName,
      phoneNumber: customer.phone || 'N/A',
      emailAddress: customer.email || 'N/A',
      billingAddress: billingAddress,
      deliveryAddress: deliveryAddress,

      items: items,

      subtotal: subtotal,
      discount: discount,
      deliveryCharges: deliveryCharges,
      vat: vat,
      vatRate: vatRate,
      grandTotal: grandTotal,

      paymentMethod: 'Cash',
      amountPaid: 0,
      paymentReceived: false,
      balanceRemaining: grandTotal,

      orderStatus: 'Confirmed',
      invoiceNumber: invoiceNumber,
      trackingNumber: '',
      expectedDispatchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      actualDispatchDate: null,
      orderNotes: 'Test order created by testSalesOrderEmail.js script for email testing',

      sendToAdmin: true,
      stockDeducted: false,
      sendToWarehouse: false,
      creditLimitCheck: true,

      approvalStatus: 'Approved',
      approvedBy: salesman._id,
      approvedAt: new Date(),
      createdBy: salesman._id,

      customerSignature: '',
    };

    // Create the order
    const order = await SalesOrder.create(orderData);
    log.success(`Order created: ${order.soNumber}`);
    console.log(`   Invoice: ${order.invoiceNumber}`);
    console.log(`   Amount: £${order.grandTotal.toFixed(2)}`);
    console.log(`   Status: ${order.orderStatus}`);
    console.log(`   Approval: ${order.approvalStatus}`);

    // ============================================
    // STEP 4: PREPARE EMAIL DATA
    // ============================================
    log.section('STEP 4: Preparing Email Data');

    const populatedOrder = await SalesOrder.findById(order._id)
      .populate('salesPerson', 'name email')
      .populate('customer', 'firstName lastName email phone')
      .populate('approvedBy', 'name email');

    const orderDetails = {
      soNumber: populatedOrder.soNumber,
      orderDate: populatedOrder.orderDate,
      orderStatus: populatedOrder.orderStatus,
      poNumber: populatedOrder.poNumber,
      customerName: populatedOrder.customerName,
      contactPerson: populatedOrder.contactPerson,
      emailAddress: populatedOrder.emailAddress,
      phoneNumber: populatedOrder.phoneNumber,
      billingAddress: populatedOrder.billingAddress,
      salesPerson: populatedOrder.salesPerson,
      invoiceNumber: populatedOrder.invoiceNumber,
      items: populatedOrder.items,
      subtotal: populatedOrder.subtotal,
      discount: populatedOrder.discount,
      deliveryCharges: populatedOrder.deliveryCharges,
      vat: populatedOrder.vat,
      vatRate: populatedOrder.vatRate,
      grandTotal: populatedOrder.grandTotal,
      paymentMethod: populatedOrder.paymentMethod,
      amountPaid: populatedOrder.amountPaid,
      balanceRemaining: populatedOrder.balanceRemaining,
    };

    console.log(`   Order Number: ${orderDetails.soNumber}`);
    console.log(`   Customer: ${orderDetails.customerName}`);
    console.log(`   Amount: £${orderDetails.grandTotal.toFixed(2)}`);
    console.log(`   Sales Person: ${orderDetails.salesPerson?.name || orderDetails.salesPerson?.email || 'N/A'}`);
    console.log(`   Invoice: ${orderDetails.invoiceNumber || 'N/A'}`);

    const APPROVAL_EMAIL = 'talhaabid400@gmail.com';
    console.log(`\n   📧 Sending to: ${APPROVAL_EMAIL}`);

    // ============================================
    // STEP 5: SEND EMAIL
    // ============================================
    log.section('STEP 5: Sending Email to Admin');

    log.info('Attempting to send email (formal Sales Order Report - Sales Rep Hub)...');
    
    const result = await sendOrderApprovalEmail(APPROVAL_EMAIL, 'Admin', orderDetails);

    if (result.success) {
      log.success('Email sent successfully!');
      console.log(`   Message ID: ${result.messageId || 'N/A'}`);
      console.log(`   Sent to: ${APPROVAL_EMAIL}`);
      console.log(`   Subject: Sales Order Report: ${orderDetails.soNumber} - ${orderDetails.customerName}`);
      console.log(`\n${colors.green}✅ Check your inbox at ${APPROVAL_EMAIL}${colors.reset}`);
      console.log(`   Look for formal Sales Order Report (Sales Rep Hub).`);
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
    // STEP 6: SUMMARY
    // ============================================
    log.section('STEP 6: Test Summary');

    console.log(`\n${colors.bright}Test Results:${colors.reset}`);
    console.log(`   Order Created: ${order.soNumber}`);
    console.log(`   Order Status: ${order.orderStatus}`);
    console.log(`   Approval Status: ${order.approvalStatus}`);
    console.log(`   Email Sent: ${result.success ? '✅ Yes' : '❌ No'}`);
    console.log(`   Email Recipient: ${APPROVAL_EMAIL}`);
    
    if (result.success) {
      log.success('\n✅ Email test completed successfully!');
      console.log(`\n${colors.green}📧 Email should be in inbox: ${APPROVAL_EMAIL}${colors.reset}`);
      console.log(`   Subject: Sales Order Report: ${orderDetails.soNumber} - ${orderDetails.customerName}`);
      console.log(`   Check your inbox and spam folder if not found.`);
    } else {
      log.error('\n❌ Email test failed!');
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
  testSalesOrderEmail();
}

module.exports = testSalesOrderEmail;
