const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');
const SalesTarget = require('../database/models/SalesTarget');

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

const testSalesOrderFull = async () => {
  try {
    log.header('SALES ORDER FULL TEST SCRIPT');
    
    // Connect to database
    await connectDB();
    log.success('Connected to database\n');

    // ============================================
    // STEP 1: VALIDATE PREREQUISITES
    // ============================================
    log.section('STEP 1: Validating Prerequisites');
    
    const salesmen = await User.find({ role: 'salesman' }).limit(3);
    if (salesmen.length === 0) {
      log.error('No salesmen found. Please create at least one salesman first.');
      process.exit(1);
    }
    log.info(`Found ${salesmen.length} salesmen`);
    salesmen.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name} (${s.email})`);
    });

    const customers = await Customer.find().limit(3);
    if (customers.length === 0) {
      log.error('No customers found. Please create at least one customer first.');
      process.exit(1);
    }
    log.info(`Found ${customers.length} customers`);
    customers.forEach((c, i) => {
      const name = c.firstName ? `${c.firstName} ${c.name || ''}`.trim() : c.name || 'Unknown';
      console.log(`   ${i + 1}. ${name} (${c.email || 'No email'})`);
    });

    const products = await Product.find().limit(5);
    if (products.length === 0) {
      log.error('No products found. Please create at least one product first.');
      process.exit(1);
    }
    log.info(`Found ${products.length} products`);
    products.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - £${(p.price || 0).toFixed(2)}`);
    });

    // ============================================
    // STEP 2: TEST SCENARIOS
    // ============================================
    log.section('STEP 2: Creating Test Orders');

    const testOrders = [];
    const testScenarios = [
      {
        name: 'Single Item Order',
        items: 1,
        discount: 0,
        deliveryCharges: 10,
      },
      {
        name: 'Multiple Items Order',
        items: 3,
        discount: 50,
        deliveryCharges: 15,
      },
      {
        name: 'High Value Order',
        items: 5,
        discount: 100,
        deliveryCharges: 25,
      },
    ];

    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i];
      const salesman = salesmen[i % salesmen.length];
      const customer = customers[i % customers.length];
      
      log.info(`Creating: ${scenario.name}`);

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
        continue;
      }

      // Create order items
      const items = [];
      for (let j = 0; j < scenario.items && j < products.length; j++) {
        const product = products[j];
        const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 items
        items.push({
          productCode: product.productCode || `PROD${j + 1}`,
          productName: product.name,
          productId: product._id,
          spec: product.spec || 'Standard specification',
          unitPrice: product.price || 50.00,
          quantity: quantity,
          unit: 'Rolls',
          lineTotal: (product.price || 50.00) * quantity,
        });
      }

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const discount = scenario.discount;
      const deliveryCharges = scenario.deliveryCharges;
      const vatRate = 20;
      const vat = parseFloat(((subtotal - discount + deliveryCharges) * (vatRate / 100)).toFixed(2));
      const grandTotal = parseFloat((subtotal - discount + deliveryCharges + vat).toFixed(2));

      // Build customer name
      const customerName = customer.firstName 
        ? `${customer.firstName}${customer.name ? ' ' + customer.name : ''}`.trim()
        : customer.name || 'Unknown Customer';

      // Build addresses
      const billingAddress = customer.address 
        ? `${customer.address}, ${customer.city || ''}, ${customer.state || ''}, ${customer.postcode || customer.pincode || ''}`.trim()
        : 'Address not provided';
      
      const deliveryAddress = billingAddress;

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

      // Create order data - BY DEFAULT APPROVED
      const orderDate = new Date();
      orderDate.setHours(12, 0, 0, 0); // Set to noon for consistent date comparison

      const orderData = {
        // Section A: Order Information
        soNumber: soNumber,
        orderDate: orderDate,
        salesPerson: salesman._id,
        salesPersonEmail: salesman.email,
        poNumber: `PO-${Math.floor(Math.random() * 10000)}`,
        orderSource: 'Full Test Script',

        // Section B: Customer Details
        customer: customer._id,
        customerName: customerName,
        contactPerson: customer.contactPerson || customerName,
        phoneNumber: customer.phone || 'N/A',
        emailAddress: customer.email || 'N/A',
        billingAddress: billingAddress,
        deliveryAddress: deliveryAddress,

        // Section C: Product Line Items
        items: items,

        // Section D: Order Totals
        subtotal: subtotal,
        discount: discount,
        deliveryCharges: deliveryCharges,
        vat: vat,
        vatRate: vatRate,
        grandTotal: grandTotal,

        // Section E: Payment Information
        paymentMethod: 'Cash',
        amountPaid: 0,
        paymentReceived: false,
        balanceRemaining: grandTotal,

        // Section F: Status & Workflow
        orderStatus: 'Confirmed', // Confirmed status for approved orders
        invoiceNumber: invoiceNumber,
        trackingNumber: '',
        expectedDispatchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        actualDispatchDate: null,
        orderNotes: `Test order: ${scenario.name} - Created by full test script`,

        // Section G: Internal Flags
        sendToAdmin: true,
        stockDeducted: false,
        sendToWarehouse: false,
        creditLimitCheck: true,

        // BY DEFAULT APPROVED - All orders are auto-approved
        approvalStatus: 'Approved',
        approvedBy: salesman._id,
        approvedAt: new Date(),
        createdBy: salesman._id,

        // Customer Signature
        customerSignature: '',
      };

      // Create the order
      const order = await SalesOrder.create(orderData);
      testOrders.push(order);
      
      log.success(`Order ${i + 1} created: ${order.soNumber}`);
    }

    // ============================================
    // STEP 3: VALIDATE ORDERS
    // ============================================
    log.section('STEP 3: Validating Created Orders');

    for (let i = 0; i < testOrders.length; i++) {
      const order = testOrders[i];
      
      // Populate and fetch full order
      const populatedOrder = await SalesOrder.findById(order._id)
        .populate('salesPerson', 'name email')
        .populate('customer', 'name firstName email phone')
        .populate('approvedBy', 'name email')
        .populate('createdBy', 'name email');

      log.info(`\nOrder ${i + 1}: ${populatedOrder.soNumber}`);
      console.log(`   Status: ${populatedOrder.orderStatus}`);
      console.log(`   Approval: ${populatedOrder.approvalStatus}`);
      
      // Validate approval status
      if (populatedOrder.approvalStatus !== 'Approved') {
        log.error(`   ❌ Order should be Approved but is ${populatedOrder.approvalStatus}`);
      } else {
        log.success(`   ✅ Order is Approved`);
      }

      // Validate order status
      if (populatedOrder.orderStatus !== 'Confirmed') {
        log.warning(`   ⚠️  Order status is ${populatedOrder.orderStatus} (expected Confirmed)`);
      } else {
        log.success(`   ✅ Order status is Confirmed`);
      }

      // Validate invoice number
      if (!populatedOrder.invoiceNumber) {
        log.error(`   ❌ Invoice number is missing`);
      } else {
        log.success(`   ✅ Invoice number: ${populatedOrder.invoiceNumber}`);
      }

      // Validate totals
      const calculatedSubtotal = populatedOrder.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
      if (Math.abs(populatedOrder.subtotal - calculatedSubtotal) > 0.01) {
        log.error(`   ❌ Subtotal mismatch: ${populatedOrder.subtotal} vs ${calculatedSubtotal}`);
      } else {
        log.success(`   ✅ Subtotal: £${populatedOrder.subtotal.toFixed(2)}`);
      }

      const calculatedVat = (populatedOrder.subtotal - populatedOrder.discount + populatedOrder.deliveryCharges) * (populatedOrder.vatRate / 100);
      if (Math.abs(populatedOrder.vat - calculatedVat) > 0.01) {
        log.error(`   ❌ VAT mismatch: ${populatedOrder.vat} vs ${calculatedVat}`);
      } else {
        log.success(`   ✅ VAT: £${populatedOrder.vat.toFixed(2)}`);
      }

      const calculatedGrandTotal = populatedOrder.subtotal - populatedOrder.discount + populatedOrder.deliveryCharges + populatedOrder.vat;
      if (Math.abs(populatedOrder.grandTotal - calculatedGrandTotal) > 0.01) {
        log.error(`   ❌ Grand Total mismatch: ${populatedOrder.grandTotal} vs ${calculatedGrandTotal}`);
      } else {
        log.success(`   ✅ Grand Total: £${populatedOrder.grandTotal.toFixed(2)}`);
      }

      // Validate populated fields
      if (!populatedOrder.salesPerson) {
        log.error(`   ❌ Sales person not populated`);
      } else {
        log.success(`   ✅ Sales Person: ${populatedOrder.salesPerson.name}`);
      }

      if (!populatedOrder.approvedBy) {
        log.error(`   ❌ Approved by not populated`);
      } else {
        log.success(`   ✅ Approved By: ${populatedOrder.approvedBy.name}`);
      }

      if (!populatedOrder.approvedAt) {
        log.error(`   ❌ Approved at timestamp missing`);
      } else {
        log.success(`   ✅ Approved At: ${populatedOrder.approvedAt.toLocaleString()}`);
      }

      // Display order summary
      console.log(`\n   📋 Order Summary:`);
      console.log(`      Customer: ${populatedOrder.customerName}`);
      console.log(`      Items: ${populatedOrder.items.length}`);
      console.log(`      Discount: £${populatedOrder.discount.toFixed(2)}`);
      console.log(`      Delivery: £${populatedOrder.deliveryCharges.toFixed(2)}`);
      console.log(`      Balance: £${populatedOrder.balanceRemaining.toFixed(2)}`);
    }

    // ============================================
    // STEP 4: CHECK SALES TARGETS
    // ============================================
    log.section('STEP 4: Checking Sales Target Updates');

    for (const order of testOrders) {
      const orderDate = new Date(order.orderDate);
      orderDate.setHours(12, 0, 0, 0);

      // Find active targets for this salesman
      const targets = await SalesTarget.find({
        salesman: order.salesPerson,
        targetType: 'Orders',
        status: 'Active',
        startDate: { $lte: orderDate },
        endDate: { $gte: orderDate },
      });

      if (targets.length > 0) {
        log.info(`Order ${order.soNumber} matches ${targets.length} target(s)`);
        for (const target of targets) {
          console.log(`   Target: ${target.targetName} (Progress: ${target.currentProgress}/${target.targetValue})`);
        }
      } else {
        log.warning(`Order ${order.soNumber} doesn't match any active targets`);
      }
    }

    // ============================================
    // STEP 5: SUMMARY
    // ============================================
    log.section('STEP 5: Test Summary');

    const totalOrders = testOrders.length;
    const approvedOrders = testOrders.filter(o => o.approvalStatus === 'Approved').length;
    const confirmedOrders = testOrders.filter(o => o.orderStatus === 'Confirmed').length;
    const totalValue = testOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    console.log(`\n${colors.bright}Test Results:${colors.reset}`);
    console.log(`   Total Orders Created: ${totalOrders}`);
    console.log(`   Approved Orders: ${approvedOrders} / ${totalOrders}`);
    console.log(`   Confirmed Orders: ${confirmedOrders} / ${totalOrders}`);
    console.log(`   Total Order Value: £${totalValue.toFixed(2)}`);
    
    if (approvedOrders === totalOrders && confirmedOrders === totalOrders) {
      log.success('\n✅ All tests passed! All orders are approved and confirmed.');
    } else {
      log.error('\n❌ Some tests failed. Check the validation results above.');
    }

    // Display all order SO numbers
    console.log(`\n${colors.cyan}Created Order SO Numbers:${colors.reset}`);
    testOrders.forEach((order, i) => {
      console.log(`   ${i + 1}. ${order.soNumber} - £${order.grandTotal.toFixed(2)}`);
    });

    log.header('TEST COMPLETED');
    console.log(`\n${colors.green}✅ Full test completed successfully!${colors.reset}\n`);

    process.exit(0);
  } catch (error) {
    log.error('Error in full test:');
    console.error(error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the test
if (require.main === module) {
  testSalesOrderFull();
}

module.exports = testSalesOrderFull;
