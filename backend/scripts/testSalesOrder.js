const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');

const testSalesOrder = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Get first available salesman
    const salesman = await User.findOne({ role: 'salesman' });
    if (!salesman) {
      console.log('❌ No salesman found. Please create a salesman first.');
      process.exit(1);
    }
    console.log(`👤 Using Salesman: ${salesman.name} (${salesman.email})`);

    // Get first available customer
    const customer = await Customer.findOne();
    if (!customer) {
      console.log('❌ No customer found. Please create a customer first.');
      process.exit(1);
    }
    console.log(`👥 Using Customer: ${customer.name || customer.firstName} (${customer.email || 'No email'})`);

    // Get first available product
    const product = await Product.findOne();
    if (!product) {
      console.log('❌ No product found. Please create a product first.');
      process.exit(1);
    }
    console.log(`📦 Using Product: ${product.name} (${product.productCode || 'No code'})`);

    // Generate unique SO number
    let soNumber;
    let isUnique = false;
    while (!isUnique) {
      const prefix = 'SO';
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      soNumber = `${prefix}${randomNum}`;
      const exists = await SalesOrder.findOne({ soNumber });
      if (!exists) {
        isUnique = true;
      }
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

    // Build customer name
    const customerName = customer.firstName 
      ? `${customer.firstName}${customer.name ? ' ' + customer.name : ''}`
      : customer.name || 'Unknown Customer';

    // Build addresses
    const billingAddress = customer.address 
      ? `${customer.address}, ${customer.city || ''}, ${customer.state || ''}, ${customer.postcode || customer.pincode || ''}`.trim()
      : 'Address not provided';
    
    const deliveryAddress = billingAddress;

    // Create order data
    const orderData = {
      // Section A: Order Information
      soNumber: soNumber,
      orderDate: new Date(),
      salesPerson: salesman._id,
      salesPersonEmail: salesman.email,
      poNumber: `PO-${Math.floor(Math.random() * 10000)}`,
      orderSource: 'Test Script',

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
      orderStatus: 'Confirmed',
      invoiceNumber: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
      trackingNumber: '',
      expectedDispatchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      actualDispatchDate: null,
      orderNotes: 'Test order created by testSalesOrder.js script',

      // Section G: Internal Flags
      sendToAdmin: true,
      stockDeducted: false,
      sendToWarehouse: false,
      creditLimitCheck: true,

      // All orders are auto-approved by default (both admin and salesman)
      approvalStatus: 'Approved',
      approvedBy: salesman._id, // Using salesman ID for testing
      approvedAt: new Date(),

      // Customer Signature
      customerSignature: '',
    };

    // Create the order
    const order = await SalesOrder.create(orderData);

    // Populate and display
    const populatedOrder = await SalesOrder.findById(order._id)
      .populate('salesPerson', 'name email')
      .populate('customer', 'name firstName email phone');

    console.log('\n✅ Sales Order Created Successfully!\n');
    console.log('📋 Order Details:');
    console.log(`   SO Number: ${populatedOrder.soNumber}`);
    console.log(`   Order Date: ${populatedOrder.orderDate.toLocaleDateString()}`);
    console.log(`   Sales Person: ${populatedOrder.salesPerson.name} (${populatedOrder.salesPerson.email})`);
    console.log(`   Customer: ${populatedOrder.customerName}`);
    console.log(`   Order Status: ${populatedOrder.orderStatus}`);
    console.log(`   Approval Status: ${populatedOrder.approvalStatus}`);
    console.log(`   Invoice Number: ${populatedOrder.invoiceNumber || 'N/A'}`);
    console.log(`\n💰 Order Totals:`);
    console.log(`   Subtotal: £${populatedOrder.subtotal.toFixed(2)}`);
    console.log(`   Discount: £${populatedOrder.discount.toFixed(2)}`);
    console.log(`   Delivery Charges: £${populatedOrder.deliveryCharges.toFixed(2)}`);
    console.log(`   VAT (${populatedOrder.vatRate}%): £${populatedOrder.vat.toFixed(2)}`);
    console.log(`   Grand Total: £${populatedOrder.grandTotal.toFixed(2)}`);
    console.log(`\n📦 Items (${populatedOrder.items.length}):`);
    populatedOrder.items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.productName} - ${item.quantity} ${item.unit} @ £${item.unitPrice.toFixed(2)} = £${item.lineTotal.toFixed(2)}`);
    });
    console.log(`\n🆔 Order ID: ${populatedOrder._id}`);
    console.log('\n✅ Test completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating sales order:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the test
if (require.main === module) {
  testSalesOrder();
}

module.exports = testSalesOrder;
