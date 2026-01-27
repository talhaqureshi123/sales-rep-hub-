const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');

const checkAllSalesOrders = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Get ALL confirmed orders
    const allConfirmedOrders = await SalesOrder.find({
      orderStatus: 'Confirmed'
    })
    .populate('salesPerson', 'name email')
    .sort({ createdAt: -1 });

    console.log(`📊 Total Confirmed Orders in System: ${allConfirmedOrders.length}\n`);

    // Group by salesman
    const ordersBySalesman = {};
    
    allConfirmedOrders.forEach((order) => {
      const salesmanName = order.salesPerson ? order.salesPerson.name : 'Unknown';
      if (!ordersBySalesman[salesmanName]) {
        ordersBySalesman[salesmanName] = [];
      }
      ordersBySalesman[salesmanName].push(order);
    });

    console.log('📋 Orders by Salesman:\n');
    Object.keys(ordersBySalesman).forEach((salesmanName) => {
      console.log(`   ${salesmanName}: ${ordersBySalesman[salesmanName].length} orders`);
      ordersBySalesman[salesmanName].forEach((order, i) => {
        console.log(`      ${i + 1}. ${order.soNumber}`);
        console.log(`         - Approval Status: ${order.approvalStatus || 'N/A'}`);
        console.log(`         - Order Status: ${order.orderStatus}`);
        console.log(`         - Approved At: ${order.approvedAt ? new Date(order.approvedAt).toLocaleString() : 'N/A'}`);
        console.log(`         - Order Date: ${order.orderDate ? new Date(order.orderDate).toLocaleString() : 'N/A'}`);
        console.log(`         - Grand Total: £${order.grandTotal || 0}`);
        console.log('');
      });
    });

    // Specifically check Usman
    const usman = await User.findOne({ email: { $regex: /usman/i } });
    if (usman) {
      console.log(`\n👤 Usman's Orders:\n`);
      const usmanOrders = allConfirmedOrders.filter(o => 
        o.salesPerson && o.salesPerson._id.toString() === usman._id.toString()
      );
      console.log(`   Total: ${usmanOrders.length} confirmed orders\n`);
      
      usmanOrders.forEach((order, i) => {
        console.log(`   ${i + 1}. ${order.soNumber}`);
        console.log(`      - Approval Status: ${order.approvalStatus || 'N/A'}`);
        console.log(`      - Approved At: ${order.approvedAt ? new Date(order.approvedAt).toLocaleString() : 'N/A'}`);
        console.log(`      - Order Date: ${order.orderDate ? new Date(order.orderDate).toLocaleString() : 'N/A'}`);
        console.log(`      - Grand Total: £${order.grandTotal || 0}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  checkAllSalesOrders();
}

module.exports = checkAllSalesOrders;
