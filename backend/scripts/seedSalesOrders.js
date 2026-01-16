const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');

// Generate random date within last 30 days
const getRandomDate = () => {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  return date;
};

// Generate future date (for expected dispatch)
const getFutureDate = (days = 7) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Generate base64 signature placeholder (simple white canvas)
const generateSignature = () => {
  // Return empty string or a simple base64 encoded signature placeholder
  // In real scenario, this would be a canvas drawing
  return '';
};

const seedSalesOrders = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    // Get existing data
    const salesPersons = await User.find({ role: 'salesman' }).limit(5);
    const customers = await Customer.find().limit(10);
    const products = await Product.find().limit(10);

    if (salesPersons.length === 0) {
      console.log('❌ No salespersons found. Please seed users first.');
      process.exit(1);
    }

    if (customers.length === 0) {
      console.log('❌ No customers found. Please seed customers first.');
      process.exit(1);
    }

    if (products.length === 0) {
      console.log('❌ No products found. Please seed products first.');
      process.exit(1);
    }

    console.log(`Found ${salesPersons.length} salespersons, ${customers.length} customers, ${products.length} products`);

    const orderStatuses = ['Draft', 'Pending', 'Confirmed', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'];
    const orderSources = ['Website', 'Phone', 'Email', 'Walk-in', 'Sales Rep', 'Referral', 'Other'];
    const paymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Cheque', 'Credit Terms', 'Other'];
    const units = ['Rolls', 'Boxes', 'Pieces', 'Packs', 'Units', 'Kg', 'Liters'];

    // Create 10 sample sales orders
    const orders = [];
    const soNumbers = new Set();

    for (let i = 0; i < 10; i++) {
      // Generate unique SO number
      let soNumber;
      do {
        const prefix = 'SO';
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        soNumber = `${prefix}${randomNum}`;
      } while (soNumbers.has(soNumber));
      soNumbers.add(soNumber);

      // Random salesperson
      const salesPerson = salesPersons[Math.floor(Math.random() * salesPersons.length)];
      
      // Random customer
      const customer = customers[Math.floor(Math.random() * customers.length)];
      
      // Random status
      const orderStatus = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
      
      // Random order source
      const orderSource = orderSources[Math.floor(Math.random() * orderSources.length)];
      
      // Random payment method
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      // Generate 1-4 items per order
      const itemCount = Math.floor(Math.random() * 4) + 1;
      const items = [];
      
      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 10) + 1;
        const unitPrice = product.price || (Math.random() * 100 + 10);
        const unit = units[Math.floor(Math.random() * units.length)];
        
        items.push({
          productCode: product.productCode,
          productName: product.name,
          productId: product._id,
          spec: `Specification for ${product.name}`,
          unitPrice: parseFloat(unitPrice.toFixed(2)),
          quantity: quantity,
          unit: unit,
          lineTotal: parseFloat((unitPrice * quantity).toFixed(2)),
        });
      }

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const discount = Math.random() > 0.7 ? parseFloat((subtotal * 0.1).toFixed(2)) : 0; // 30% chance of discount
      const deliveryCharges = Math.random() > 0.5 ? parseFloat((Math.random() * 50 + 10).toFixed(2)) : 0; // 50% chance
      const vatRate = 20;
      const vat = parseFloat(((subtotal - discount + deliveryCharges) * (vatRate / 100)).toFixed(2));
      const grandTotal = parseFloat((subtotal - discount + deliveryCharges + vat).toFixed(2));
      
      // Payment info
      const amountPaid = orderStatus === 'Delivered' ? grandTotal : (Math.random() > 0.5 ? parseFloat((grandTotal * 0.5).toFixed(2)) : 0);
      const paymentReceived = amountPaid > 0;
      const balanceRemaining = parseFloat((grandTotal - amountPaid).toFixed(2));

      // Generate invoice number if not Draft
      let invoiceNumber = '';
      if (orderStatus !== 'Draft') {
        const invPrefix = 'INV';
        const invRandomNum = Math.floor(100000 + Math.random() * 900000);
        invoiceNumber = `${invPrefix}-${invRandomNum}`;
      }

      // Order dates
      const orderDate = getRandomDate();
      const expectedDispatchDate = orderStatus !== 'Draft' && orderStatus !== 'Cancelled' ? getFutureDate(Math.floor(Math.random() * 7) + 1) : null;
      const actualDispatchDate = (orderStatus === 'Dispatched' || orderStatus === 'Delivered') ? getFutureDate(-Math.floor(Math.random() * 5)) : null;

      // Build customer name
      const customerName = customer.firstName 
        ? `${customer.firstName}${customer.name ? ' ' + customer.name : ''}`
        : customer.name || 'Unknown Customer';

      // Build addresses
      const billingAddress = customer.address 
        ? `${customer.address}, ${customer.city || ''}, ${customer.state || ''}, ${customer.postcode || customer.pincode || ''}`.trim()
        : 'Address not provided';
      
      const deliveryAddress = billingAddress; // Same as billing for simplicity

      // Section G flags
      const sendToAdmin = orderStatus !== 'Draft';
      const stockDeducted = orderStatus === 'Processing' || orderStatus === 'Dispatched' || orderStatus === 'Delivered';
      const sendToWarehouse = orderStatus === 'Confirmed' || orderStatus === 'Processing' || orderStatus === 'Dispatched' || orderStatus === 'Delivered';
      const creditLimitCheck = orderStatus !== 'Draft';

      const orderData = {
        // Section A: Order Information
        soNumber: soNumber,
        orderDate: orderDate,
        salesPerson: salesPerson._id,
        salesPersonEmail: salesPerson.email,
        poNumber: Math.random() > 0.5 ? `PO-${Math.floor(Math.random() * 10000)}` : '',
        orderSource: orderSource,

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
        paymentMethod: paymentMethod,
        amountPaid: amountPaid,
        paymentReceived: paymentReceived,
        balanceRemaining: balanceRemaining,

        // Section F: Status & Workflow
        orderStatus: orderStatus,
        invoiceNumber: invoiceNumber,
        trackingNumber: orderStatus === 'Dispatched' || orderStatus === 'Delivered' ? `TRACK-${Math.floor(Math.random() * 1000000)}` : '',
        expectedDispatchDate: expectedDispatchDate,
        actualDispatchDate: actualDispatchDate,
        orderNotes: `Sample order notes for ${soNumber}. This is a test order created by seed script.`,

        // Section G: Internal Flags
        sendToAdmin: sendToAdmin,
        stockDeducted: stockDeducted,
        sendToWarehouse: sendToWarehouse,
        creditLimitCheck: creditLimitCheck,

        // Customer Signature
        customerSignature: generateSignature(),
      };

      orders.push(orderData);
    }

    // Clear existing orders (optional - comment out if you want to keep existing)
    // await SalesOrder.deleteMany({});
    // console.log('Cleared existing sales orders');

    // Insert orders
    const createdOrders = await SalesOrder.insertMany(orders);

    console.log(`\n✅ Successfully created ${createdOrders.length} sales orders:`);
    createdOrders.forEach((order, index) => {
      console.log(`  ${index + 1}. ${order.soNumber} - ${order.customerName} - ${order.orderStatus} - £${order.grandTotal.toFixed(2)}`);
    });

    console.log('\n📊 Summary:');
    const statusCounts = {};
    createdOrders.forEach(order => {
      statusCounts[order.orderStatus] = (statusCounts[order.orderStatus] || 0) + 1;
    });
    Object.keys(statusCounts).forEach(status => {
      console.log(`  ${status}: ${statusCounts[status]}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding sales orders:', error);
    process.exit(1);
  }
};

// Run the seeder
if (require.main === module) {
  seedSalesOrders();
}

module.exports = seedSalesOrders;
