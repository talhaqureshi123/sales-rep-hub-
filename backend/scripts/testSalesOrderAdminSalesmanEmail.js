/**
 * Sales Order Test: Admin + Salesman create orders, end-to-end including email.
 * Creates 2 orders (1 by admin, 1 by salesman), both auto-approved, and sends mail for each.
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');
const { sendOrderApprovalEmail } = require('../utils/emailService');

const APPROVAL_EMAIL = 'iotfiy.solution@gmail.com';

const log = {
  ok: (msg) => console.log('✅', msg),
  err: (msg) => console.log('❌', msg),
  info: (msg) => console.log('ℹ️ ', msg),
  section: (msg) => console.log('\n' + '─'.repeat(50) + '\n📋', msg + '\n' + '─'.repeat(50)),
};

async function generateUniqueSO() {
  let soNumber;
  let ok = false;
  for (let i = 0; i < 20; i++) {
    soNumber = 'SO' + (100000 + Math.floor(Math.random() * 900000));
    const exists = await SalesOrder.findOne({ soNumber });
    if (!exists) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new Error('Could not generate unique SO number');
  return soNumber;
}

async function generateUniqueInvoice() {
  let invoiceNumber;
  let ok = false;
  for (let i = 0; i < 20; i++) {
    invoiceNumber = 'INV-' + (100000 + Math.floor(Math.random() * 900000));
    const exists = await SalesOrder.findOne({ invoiceNumber });
    if (!exists) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new Error('Could not generate unique invoice number');
  return invoiceNumber;
}

async function buildOrderPayload(opts) {
  const { admin, salesman, customer, product, createdBy, sourceLabel } = opts;
  const customerName = customer.firstName
    ? `${customer.firstName}${customer.name ? ' ' + customer.name : ''}`.trim()
    : customer.name || 'Unknown Customer';
  const billingAddress = customer.address
    ? `${customer.address}, ${customer.city || ''}, ${customer.state || ''}, ${customer.postcode || customer.pincode || ''}`.trim()
    : 'Address not provided';

  const items = [{
    productCode: product.productCode || 'PROD001',
    productName: product.name,
    productId: product._id,
    spec: product.spec || 'Standard',
    unitPrice: product.price || 50,
    quantity: 2,
    unit: 'Rolls',
    lineTotal: (product.price || 50) * 2,
  }];

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const discount = 0;
  const deliveryCharges = 10;
  const vatRate = 20;
  const vat = parseFloat(((subtotal - discount + deliveryCharges) * (vatRate / 100)).toFixed(2));
  const grandTotal = parseFloat((subtotal - discount + deliveryCharges + vat).toFixed(2));

  const soNumber = await generateUniqueSO();
  const invoiceNumber = await generateUniqueInvoice();
  const orderDate = new Date();
  orderDate.setHours(12, 0, 0, 0);

  return {
    soNumber,
    orderDate,
    salesPerson: salesman._id,
    salesPersonEmail: salesman.email,
    poNumber: `PO-${Math.floor(Math.random() * 10000)}`,
    orderSource: sourceLabel,

    customer: customer._id,
    customerName,
    contactPerson: customer.contactPerson || customerName,
    phoneNumber: customer.phone || 'N/A',
    emailAddress: customer.email || 'N/A',
    billingAddress,
    deliveryAddress: billingAddress,

    items,
    subtotal,
    discount,
    deliveryCharges,
    vat,
    vatRate,
    grandTotal,

    paymentMethod: 'Cash',
    amountPaid: 0,
    paymentReceived: false,
    balanceRemaining: grandTotal,

    orderStatus: 'Confirmed',
    invoiceNumber,
    trackingNumber: '',
    expectedDispatchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    actualDispatchDate: null,
    orderNotes: `Test order created by ${sourceLabel} (testSalesOrderAdminSalesmanEmail.js)`,

    sendToAdmin: true,
    stockDeducted: false,
    sendToWarehouse: false,
    creditLimitCheck: true,

    approvalStatus: 'Approved',
    approvedBy: createdBy._id,
    approvedAt: new Date(),
    createdBy: createdBy._id,
    customerSignature: '',
  };
}

async function sendEmailForOrder(order) {
  const populated = await SalesOrder.findById(order._id)
    .populate('salesPerson', 'name email')
    .populate('customer', 'firstName lastName email phone')
    .populate('approvedBy', 'name email');

  const orderDetails = {
    soNumber: populated.soNumber,
    orderDate: populated.orderDate,
    orderStatus: populated.orderStatus,
    poNumber: populated.poNumber,
    customerName: populated.customerName,
    contactPerson: populated.contactPerson,
    emailAddress: populated.emailAddress,
    phoneNumber: populated.phoneNumber,
    billingAddress: populated.billingAddress,
    salesPerson: populated.salesPerson,
    invoiceNumber: populated.invoiceNumber,
    items: populated.items,
    subtotal: populated.subtotal,
    discount: populated.discount,
    deliveryCharges: populated.deliveryCharges,
    vat: populated.vat,
    vatRate: populated.vatRate,
    grandTotal: populated.grandTotal,
    paymentMethod: populated.paymentMethod,
    amountPaid: populated.amountPaid,
    balanceRemaining: populated.balanceRemaining,
  };

  const result = await sendOrderApprovalEmail(APPROVAL_EMAIL, 'Admin', orderDetails);
  return result;
}

async function main() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('  SALES ORDER TEST: ADMIN + SALESMAN → END-TO-END + MAIL');
    console.log('='.repeat(60));

    await connectDB();
    log.ok('Connected to database');

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      log.err('No admin found. Create an admin first.');
      process.exit(1);
    }
    log.info(`Admin: ${admin.name} (${admin.email})`);

    const salesman = await User.findOne({ role: 'salesman' });
    if (!salesman) {
      log.err('No salesman found. Create a salesman first.');
      process.exit(1);
    }
    log.info(`Salesman: ${salesman.name} (${salesman.email})`);

    const customer = await Customer.findOne();
    if (!customer) {
      log.err('No customer found. Create a customer first.');
      process.exit(1);
    }
    log.info(`Customer: ${customer.name || customer.firstName} (${customer.email || 'N/A'})`);

    const product = await Product.findOne({ isActive: true });
    if (!product) {
      log.err('No active product found. Create a product first.');
      process.exit(1);
    }
    log.info(`Product: ${product.name} (${product.productCode || 'N/A'})\n`);

    // ---------- Order 1: Created by Admin ----------
    log.section('Order 1: Created by ADMIN');
    const payload1 = await buildOrderPayload({
      admin,
      salesman,
      customer,
      product,
      createdBy: admin,
      sourceLabel: 'Admin (Test Script)',
    });
    const order1 = await SalesOrder.create(payload1);
    log.ok(`Order created: ${order1.soNumber} (Invoice: ${order1.invoiceNumber})`);
    console.log(`   Amount: £${order1.grandTotal.toFixed(2)} | Status: ${order1.orderStatus} | Approval: ${order1.approvalStatus}`);

    log.info(`Sending email to ${APPROVAL_EMAIL} for ${order1.soNumber}...`);
    const email1 = await sendEmailForOrder(order1);
    if (email1.success) {
      log.ok('Email sent for admin-created order.');
    } else {
      log.err('Email failed for admin order: ' + (email1.error || 'Unknown error'));
    }

    // ---------- Order 2: Created by Salesman ----------
    log.section('Order 2: Created by SALESMAN');
    const payload2 = await buildOrderPayload({
      admin,
      salesman,
      customer,
      product,
      createdBy: salesman,
      sourceLabel: 'Salesman (Test Script)',
    });
    const order2 = await SalesOrder.create(payload2);
    log.ok(`Order created: ${order2.soNumber} (Invoice: ${order2.invoiceNumber})`);
    console.log(`   Amount: £${order2.grandTotal.toFixed(2)} | Status: ${order2.orderStatus} | Approval: ${order2.approvalStatus}`);

    log.info(`Sending email to ${APPROVAL_EMAIL} for ${order2.soNumber}...`);
    const email2 = await sendEmailForOrder(order2);
    if (email2.success) {
      log.ok('Email sent for salesman-created order.');
    } else {
      log.err('Email failed for salesman order: ' + (email2.error || 'Unknown error'));
    }

    // ---------- Summary ----------
    console.log('\n' + '='.repeat(60));
    console.log('  SUMMARY');
    console.log('='.repeat(60));
    console.log('\n  Orders created: 2');
    console.log('    1. Admin-created:  ' + order1.soNumber + ' → Email ' + (email1.success ? 'sent' : 'failed'));
    console.log('    2. Salesman-created: ' + order2.soNumber + ' → Email ' + (email2.success ? 'sent' : 'failed'));
    console.log('\n  Mail recipient: ' + APPROVAL_EMAIL);
    console.log('  Subject: Sales Order Report: SO Number - Customer Name\n');
    log.ok('Script finished. Check inbox at ' + APPROVAL_EMAIL + ' for 2 emails.\n');

    process.exit(0);
  } catch (e) {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  }
}

main();
