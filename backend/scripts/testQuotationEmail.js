/**
 * Test Quotation Email – same format as Sales Order (Praco Packaging Supplies Ltd.)
 * Run: node scripts/testQuotationEmail.js
 * Requires: DB with at least one Quotation that has customerEmail (or we use TEST_EMAIL).
 */
const connectDB = require('../database/connection');
const Quotation = require('../database/models/Quotation');
const User = require('../database/models/User');
const { sendQuotationEmail } = require('../utils/emailService');

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

const TEST_EMAIL = 'talhaabid400@gmail.com';

const testQuotationEmail = async () => {
  try {
    log.header('QUOTATION EMAIL TEST - SAME FORMAT AS SALES ORDER');

    await connectDB();
    log.success('Connected to database\n');

    log.section('STEP 1: Checking Email Configuration');
    const config = require('../config');
    const hasPass = config.EMAIL_PASS && config.EMAIL_PASS.trim() && config.EMAIL_PASS !== 'your-app-password-here';
    const hasUser = config.EMAIL_USER && config.EMAIL_USER.trim();
    if (hasUser && hasPass) {
      log.success('EMAIL_USER and EMAIL_PASS are set');
      console.log(`   EMAIL_USER: ${config.EMAIL_USER}\n`);
    } else {
      log.warning('EMAIL_USER or EMAIL_PASS not set in backend/.env');
      if (!hasPass) log.warning('Continuing test anyway...\n');
    }

    log.section('STEP 2: Getting Test Quotation');
    const quotation = await Quotation.findOne().sort({ createdAt: -1 });
    if (!quotation) {
      log.error('No quotation found. Create at least one quotation first (admin or salesman).');
      process.exit(1);
    }
    log.info(`Quotation: ${quotation.quotationNumber} | Customer: ${quotation.customerName} | Total: £${(quotation.total || 0).toFixed(2)}`);

    const toEmail = (quotation.customerEmail || '').trim() || TEST_EMAIL;
    if (!(quotation.customerEmail || '').trim()) {
      log.warning(`Quotation has no customerEmail; sending test to: ${toEmail}`);
    } else {
      log.info(`Sending to: ${toEmail}`);
    }

    const items = (quotation.items || []).map((item) => ({
      productName: item.productName || item.productCode || '-',
      productCode: item.productCode || '-',
      quantity: item.quantity || 0,
      price: item.price || 0,
      total: item.total || 0,
    }));

    const quotationDetails = {
      quotationNumber: quotation.quotationNumber || '',
      customerName: quotation.customerName || '',
      billingAddress: quotation.customerAddress || '',
      deliveryAddress: quotation.customerAddress || '',
      subtotal: quotation.subtotal ?? quotation.total ?? 0,
      tax: quotation.tax ?? 0,
      total: quotation.total || 0,
      validUntil: quotation.validUntil || '',
      items,
      notes: quotation.notes || '',
    };

    log.section('STEP 3: Sending Quotation Email');
    log.info('Sending (Praco Packaging Supplies Ltd. format – same as Sales Order)...');
    const result = await sendQuotationEmail(toEmail, quotationDetails, null, '');

    if (result.success) {
      log.success('Quotation email sent successfully!');
      console.log(`   Message ID: ${result.messageId || 'N/A'}`);
      console.log(`   To: ${toEmail}`);
      console.log(`   Subject: Praco Sales — Quotation ${quotationDetails.quotationNumber} – ${quotationDetails.customerName}`);
      console.log(`\n${colors.green}✅ Check inbox (and spam) at ${toEmail}${colors.reset}`);
    } else {
      log.error('Quotation email failed!');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
      process.exit(1);
    }

    log.section('STEP 4: Summary');
    console.log(`   Quotation: ${quotationDetails.quotationNumber}`);
    console.log(`   Customer: ${quotationDetails.customerName}`);
    console.log(`   Total: £${Number(quotationDetails.total).toFixed(2)}`);
    console.log(`   Email sent: ✅ Yes`);
    log.header('QUOTATION EMAIL TEST COMPLETED');
    process.exit(0);
  } catch (err) {
    log.error('Error in quotation email test:');
    console.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  testQuotationEmail();
}

module.exports = testQuotationEmail;
