const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const SalesTarget = require('../database/models/SalesTarget');
const User = require('../database/models/User');

const testSalesTargetUpdate = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');
    console.log('🔍 Testing Sales Target Update Logic...\n');

    // Find Usman
    const usman = await User.findOne({ email: { $regex: /usman/i } });
    if (!usman) {
      console.log('❌ Usman not found');
      process.exit(1);
    }
    console.log(`👤 Found Usman: ${usman.name} (${usman.email})\n`);

    // Get Usman's targets
    const targets = await SalesTarget.find({
      salesman: usman._id,
      status: 'Active'
    });

    console.log(`🎯 Active Targets for Usman: ${targets.length}\n`);
    
    targets.forEach((target, i) => {
      console.log(`   ${i + 1}. ${target.targetName}`);
      console.log(`      - Type: ${target.targetType}`);
      console.log(`      - Period: ${target.period}`);
      console.log(`      - Start Date: ${new Date(target.startDate).toLocaleDateString()}`);
      console.log(`      - End Date: ${new Date(target.endDate).toLocaleDateString()}`);
      console.log(`      - Target Value: ${target.targetValue}`);
      console.log(`      - Current Progress: ${target.currentProgress || 0}`);
      console.log('');
    });

    // Get all approved orders for Usman
    const approvedOrders = await SalesOrder.find({
      salesPerson: usman._id,
      approvalStatus: 'Approved',
      orderStatus: 'Confirmed'
    }).sort({ approvedAt: -1 });

    console.log(`📊 Total Approved Orders for Usman: ${approvedOrders.length}\n`);

    // Check which orders should match which targets
    for (const order of approvedOrders) {
      const approvalDate = order.approvedAt || order.orderDate || new Date();
      console.log(`\n📋 Order: ${order.soNumber}`);
      console.log(`   - Approved At: ${new Date(approvalDate).toLocaleString()}`);
      console.log(`   - Amount: £${order.grandTotal || 0}`);
      
      // Check which targets this order should match
      for (const target of targets) {
        const targetStart = new Date(target.startDate);
        targetStart.setHours(0, 0, 0, 0);
        const targetEnd = new Date(target.endDate);
        targetEnd.setHours(23, 59, 59, 999);
        const approvalDateNormalized = new Date(approvalDate);
        approvalDateNormalized.setHours(12, 0, 0, 0);
        
        const shouldMatch = approvalDateNormalized >= targetStart && approvalDateNormalized <= targetEnd;
        
        console.log(`   - Target "${target.targetName}" (${target.period}): ${shouldMatch ? '✅ MATCHES' : '❌ Does not match'}`);
        if (shouldMatch) {
          console.log(`     * Should update ${target.targetType} target`);
          if (target.targetType === 'Orders') {
            console.log(`     * Should add: 1 order`);
          } else if (target.targetType === 'Revenue') {
            console.log(`     * Should add: £${order.grandTotal || 0}`);
          }
        }
      }
    }

    // Manually recalculate progress for all targets
    console.log('\n\n🔄 Manually Recalculating Target Progress...\n');
    
    for (const target of targets) {
      const targetStart = new Date(target.startDate);
      targetStart.setHours(0, 0, 0, 0);
      const targetEnd = new Date(target.endDate);
      targetEnd.setHours(23, 59, 59, 999);
      
      let newProgress = 0;
      
      if (target.targetType === 'Orders') {
        const orderCount = await SalesOrder.countDocuments({
          salesPerson: usman._id,
          $or: [
            {
              approvedAt: { $gte: targetStart, $lte: targetEnd },
              approvalStatus: 'Approved',
              orderStatus: 'Confirmed'
            },
            {
              orderDate: { $gte: targetStart, $lte: targetEnd },
              orderStatus: 'Confirmed',
              $or: [
                { approvedAt: { $exists: false } },
                { approvedAt: null }
              ]
            }
          ]
        });
        newProgress = orderCount;
      } else if (target.targetType === 'Revenue') {
        const orders = await SalesOrder.find({
          salesPerson: usman._id,
          $or: [
            {
              approvedAt: { $gte: targetStart, $lte: targetEnd },
              approvalStatus: 'Approved',
              orderStatus: 'Confirmed'
            },
            {
              orderDate: { $gte: targetStart, $lte: targetEnd },
              orderStatus: 'Confirmed',
              $or: [
                { approvedAt: { $exists: false } },
                { approvedAt: null }
              ]
            }
          ]
        });
        newProgress = orders.reduce((sum, order) => sum + (order.grandTotal || 0), 0);
      }
      
      const oldProgress = target.currentProgress || 0;
      
      if (oldProgress !== newProgress) {
        target.currentProgress = newProgress;
        await target.save();
        console.log(`✅ Updated "${target.targetName}": ${oldProgress} → ${newProgress}`);
      } else {
        console.log(`ℹ️  "${target.targetName}" already correct: ${newProgress}`);
      }
    }

    console.log('\n✅ Test completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  testSalesTargetUpdate();
}

module.exports = testSalesTargetUpdate;
