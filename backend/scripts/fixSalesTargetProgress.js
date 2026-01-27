const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const SalesTarget = require('../database/models/SalesTarget');
const User = require('../database/models/User');

const fixSalesTargetProgress = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');
    console.log('🔧 Fixing Sales Target Progress...\n');

    // Find Usman
    const usman = await User.findOne({ email: { $regex: /usman/i } });
    if (!usman) {
      console.log('❌ Usman not found');
      process.exit(1);
    }
    console.log(`👤 Found Usman: ${usman.name} (${usman.email})\n`);

    // Get all sales targets for Usman
    const targets = await SalesTarget.find({
      salesman: usman._id,
      status: 'Active'
    });

    console.log(`🎯 Found ${targets.length} active target(s) for Usman\n`);

    for (const target of targets) {
      console.log(`\n📋 Processing Target: ${target.targetName}`);
      console.log(`   - Type: ${target.targetType}`);
      console.log(`   - Period: ${target.period}`);
      console.log(`   - Date Range: ${new Date(target.startDate).toLocaleDateString()} to ${new Date(target.endDate).toLocaleDateString()}`);
      
      const startDate = new Date(target.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(target.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      let newProgress = 0;
      
      if (target.targetType === 'Orders') {
        // Count all confirmed orders (approved or pending)
        const matchingOrders = await SalesOrder.find({
          salesPerson: usman._id,
          orderStatus: 'Confirmed',
          $or: [
            // Orders approved within date range
            {
              approvedAt: { $gte: startDate, $lte: endDate },
              approvalStatus: 'Approved'
            },
            // Orders with orderDate in range (including pending approval)
            {
              orderDate: { $gte: startDate, $lte: endDate },
              $or: [
                { approvedAt: { $exists: false } },
                { approvedAt: null },
                { approvedAt: { $lt: startDate } },
                { approvedAt: { $gt: endDate } }
              ]
            }
          ]
        });
        
        newProgress = matchingOrders.length;
        console.log(`   - Found ${matchingOrders.length} matching confirmed orders:`);
        matchingOrders.forEach((order, i) => {
          console.log(`     ${i + 1}. ${order.soNumber} - ${order.approvalStatus || 'Pending'} - £${order.grandTotal || 0}`);
        });
      } else if (target.targetType === 'Revenue') {
        const matchingOrders = await SalesOrder.find({
          salesPerson: usman._id,
          orderStatus: 'Confirmed',
          $or: [
            {
              approvedAt: { $gte: startDate, $lte: endDate },
              approvalStatus: 'Approved'
            },
            {
              orderDate: { $gte: startDate, $lte: endDate },
              $or: [
                { approvedAt: { $exists: false } },
                { approvedAt: null },
                { approvedAt: { $lt: startDate } },
                { approvedAt: { $gt: endDate } }
              ]
            }
          ]
        });
        
        newProgress = matchingOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0);
        console.log(`   - Found ${matchingOrders.length} matching orders with total: £${newProgress.toFixed(2)}`);
      }
      
      const oldProgress = target.currentProgress || 0;
      
      if (oldProgress !== newProgress) {
        target.currentProgress = newProgress;
        await target.save();
        console.log(`   ✅ Updated progress: ${oldProgress} → ${newProgress}`);
      } else {
        console.log(`   ℹ️  Progress already correct: ${newProgress}`);
      }
    }

    console.log('\n✅ Fix completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  fixSalesTargetProgress();
}

module.exports = fixSalesTargetProgress;
