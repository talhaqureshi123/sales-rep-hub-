const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');

const testAdminSalesOrders = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Find admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ No admin user found');
      process.exit(1);
    }

    console.log(`👑 Admin User: ${admin.name} (${admin.email})`);
    console.log(`   ID: ${admin._id}\n`);

    // Count total orders
    const totalOrders = await SalesOrder.countDocuments({});
    console.log(`📊 Total Orders in Database: ${totalOrders}\n`);

    // Get all orders (as admin would see)
    const allOrders = await SalesOrder.find({})
      .populate('salesPerson', 'name email')
      .populate('customer', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`📦 Sample Orders (Last 10):`);
    console.log(`   Total found: ${allOrders.length}\n`);

    allOrders.forEach((order, i) => {
      console.log(`${i + 1}. ${order.soNumber}`);
      console.log(`   Customer: ${order.customerName}`);
      console.log(`   Sales Person: ${order.salesPerson?.name || 'N/A'} (${order.salesPerson?.email || 'N/A'})`);
      console.log(`   Status: ${order.orderStatus}`);
      console.log(`   Approval: ${order.approvalStatus}`);
      console.log(`   Amount: £${order.grandTotal?.toFixed(2) || '0.00'}`);
      console.log(`   Date: ${new Date(order.orderDate || order.createdAt).toLocaleDateString()}`);
      console.log('');
    });

    // Count by status
    const statusCounts = await SalesOrder.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log(`📊 Orders by Status:`);
    statusCounts.forEach(stat => {
      console.log(`   ${stat._id || 'N/A'}: ${stat.count}`);
    });

    // Count by salesman
    const salesmanCounts = await SalesOrder.aggregate([
      {
        $group: {
          _id: '$salesPerson',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    console.log(`\n👤 Top 5 Salesmen by Order Count:`);
    for (const stat of salesmanCounts) {
      if (stat._id) {
        const salesman = await User.findById(stat._id);
        console.log(`   ${salesman?.name || 'Unknown'}: ${stat.count} orders`);
      }
    }

    // Count by approval status
    const approvalCounts = await SalesOrder.aggregate([
      {
        $group: {
          _id: '$approvalStatus',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log(`\n✅ Orders by Approval Status:`);
    approvalCounts.forEach(stat => {
      console.log(`   ${stat._id || 'N/A'}: ${stat.count}`);
    });

    console.log(`\n✅ Admin should see ALL ${totalOrders} orders in the dashboard\n`);
    console.log('✅ Test completed!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  testAdminSalesOrders();
}

module.exports = testAdminSalesOrders;
