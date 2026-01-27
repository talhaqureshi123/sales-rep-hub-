const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User');
const SalesTarget = require('../database/models/SalesTarget');

const checkUsmanOrders = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Find Usman
    const usman = await User.findOne({ email: { $regex: /usman/i } });
    if (!usman) {
      console.log('❌ Usman not found');
      process.exit(1);
    }
    console.log(`👤 Found Usman: ${usman.name} (${usman.email})\n`);

    // Check target date (1/28/2026)
    const targetDate = new Date('2026-01-28');
    targetDate.setHours(0, 0, 0, 0);
    const endDate = new Date('2026-01-28');
    endDate.setHours(23, 59, 59, 999);

    console.log(`📅 Checking orders for date: ${targetDate.toLocaleDateString()}\n`);

    // Find all approved orders for Usman
    const allApprovedOrders = await SalesOrder.find({
      salesPerson: usman._id,
      approvalStatus: 'Approved',
      orderStatus: 'Confirmed'
    }).sort({ approvedAt: -1 });

    console.log(`📊 Total Approved Orders for Usman: ${allApprovedOrders.length}\n`);

    // Check orders on target date
    const ordersOnTargetDate = await SalesOrder.find({
      salesPerson: usman._id,
      $or: [
        {
          approvedAt: { $gte: targetDate, $lte: endDate },
          approvalStatus: 'Approved',
          orderStatus: 'Confirmed'
        },
        {
          orderDate: { $gte: targetDate, $lte: endDate },
          orderStatus: 'Confirmed',
          $or: [
            { approvedAt: { $exists: false } },
            { approvedAt: null }
          ]
        }
      ]
    });

    console.log(`📋 Orders on Target Date (2026-01-28): ${ordersOnTargetDate.length}\n`);
    if (ordersOnTargetDate.length > 0) {
      ordersOnTargetDate.forEach((order, i) => {
        console.log(`   ${i + 1}. ${order.soNumber}`);
        console.log(`      - Approval Status: ${order.approvalStatus}`);
        console.log(`      - Order Status: ${order.orderStatus}`);
        console.log(`      - Approved At: ${order.approvedAt ? new Date(order.approvedAt).toLocaleString() : 'N/A'}`);
        console.log(`      - Order Date: ${order.orderDate ? new Date(order.orderDate).toLocaleString() : 'N/A'}`);
        console.log(`      - Grand Total: £${order.grandTotal || 0}`);
        console.log('');
      });
    }

    // Check all recent orders
    console.log('\n📋 Recent Approved Orders (Last 10):\n');
    allApprovedOrders.slice(0, 10).forEach((order, i) => {
      console.log(`   ${i + 1}. ${order.soNumber}`);
      console.log(`      - Approved At: ${order.approvedAt ? new Date(order.approvedAt).toLocaleString() : 'N/A'}`);
      console.log(`      - Order Date: ${order.orderDate ? new Date(order.orderDate).toLocaleString() : 'N/A'}`);
      console.log(`      - Grand Total: £${order.grandTotal || 0}`);
      console.log('');
    });

    // Check sales targets for Usman
    const targets = await SalesTarget.find({
      salesman: usman._id
    }).populate('salesman', 'name email');

    console.log(`\n🎯 Sales Targets for Usman: ${targets.length}\n`);
    targets.forEach((target, i) => {
      console.log(`   ${i + 1}. ${target.targetName}`);
      console.log(`      - Type: ${target.targetType}`);
      console.log(`      - Period: ${target.period}`);
      console.log(`      - Start Date: ${new Date(target.startDate).toLocaleDateString()}`);
      console.log(`      - End Date: ${new Date(target.endDate).toLocaleDateString()}`);
      console.log(`      - Target Value: ${target.targetValue}`);
      console.log(`      - Current Progress: ${target.currentProgress || 0}`);
      console.log(`      - Status: ${target.status}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  checkUsmanOrders();
}

module.exports = checkUsmanOrders;
