const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const SalesTarget = require('../database/models/SalesTarget');
const User = require('../database/models/User');

const checkAllConfirmedOrders = async () => {
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

    // Get ALL confirmed orders (regardless of approval status)
    const allConfirmedOrders = await SalesOrder.find({
      salesPerson: usman._id,
      orderStatus: 'Confirmed'
    }).sort({ createdAt: -1 });

    console.log(`📊 Total Confirmed Orders for Usman: ${allConfirmedOrders.length}\n`);

    allConfirmedOrders.forEach((order, i) => {
      console.log(`   ${i + 1}. ${order.soNumber}`);
      console.log(`      - Approval Status: ${order.approvalStatus || 'N/A'}`);
      console.log(`      - Order Status: ${order.orderStatus}`);
      console.log(`      - Approved At: ${order.approvedAt ? new Date(order.approvedAt).toLocaleString() : 'N/A'}`);
      console.log(`      - Order Date: ${order.orderDate ? new Date(order.orderDate).toLocaleString() : 'N/A'}`);
      console.log(`      - Created At: ${order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}`);
      console.log(`      - Grand Total: £${order.grandTotal || 0}`);
      console.log('');
    });

    // Get all sales targets for Usman
    const targets = await SalesTarget.find({
      salesman: usman._id
    }).populate('salesman', 'name email');

    console.log(`\n🎯 Sales Targets for Usman: ${targets.length}\n`);
    
    for (const target of targets) {
      console.log(`   ${target.targetName}`);
      console.log(`      - Type: ${target.targetType}`);
      console.log(`      - Period: ${target.period}`);
      console.log(`      - Start Date: ${new Date(target.startDate).toLocaleDateString()}`);
      console.log(`      - End Date: ${new Date(target.endDate).toLocaleDateString()}`);
      console.log(`      - Target Value: ${target.targetValue}`);
      console.log(`      - Current Progress (stored): ${target.currentProgress || 0}`);
      console.log(`      - Status: ${target.status}`);
      
      // Calculate what progress SHOULD be
      const startDate = new Date(target.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(target.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      let calculatedProgress = 0;
      
      if (target.targetType === 'Orders') {
        const matchingOrders = await SalesOrder.find({
          salesPerson: usman._id,
          $or: [
            {
              approvedAt: { $gte: startDate, $lte: endDate },
              approvalStatus: 'Approved',
              orderStatus: 'Confirmed'
            },
            {
              orderDate: { $gte: startDate, $lte: endDate },
              orderStatus: 'Confirmed',
              $or: [
                { approvedAt: { $exists: false } },
                { approvedAt: null }
              ]
            }
          ]
        });
        calculatedProgress = matchingOrders.length;
        console.log(`      - Calculated Progress (should be): ${calculatedProgress}`);
        console.log(`      - Matching Orders: ${matchingOrders.map(o => o.soNumber).join(', ') || 'None'}`);
      } else if (target.targetType === 'Revenue') {
        const matchingOrders = await SalesOrder.find({
          salesPerson: usman._id,
          $or: [
            {
              approvedAt: { $gte: startDate, $lte: endDate },
              approvalStatus: 'Approved',
              orderStatus: 'Confirmed'
            },
            {
              orderDate: { $gte: startDate, $lte: endDate },
              orderStatus: 'Confirmed',
              $or: [
                { approvedAt: { $exists: false } },
                { approvedAt: null }
              ]
            }
          ]
        });
        calculatedProgress = matchingOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0);
        console.log(`      - Calculated Progress (should be): £${calculatedProgress.toFixed(2)}`);
        console.log(`      - Matching Orders: ${matchingOrders.map(o => `${o.soNumber} (£${o.grandTotal || 0})`).join(', ') || 'None'}`);
      }
      
      if (target.currentProgress !== calculatedProgress) {
        console.log(`      ⚠️  MISMATCH! Stored: ${target.currentProgress}, Should be: ${calculatedProgress}`);
        // Update it
        target.currentProgress = calculatedProgress;
        await target.save();
        console.log(`      ✅ Updated to: ${calculatedProgress}`);
      } else {
        console.log(`      ✅ Progress is correct`);
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  checkAllConfirmedOrders();
}

module.exports = checkAllConfirmedOrders;
