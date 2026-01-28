/**
 * Check why orders are not counting in sales target
 * Usage: node backend/scripts/checkSalesTargetOrders.js
 */

const connectDB = require('../database/connection');
const SalesOrder = require('../database/models/SalesOrder');
const SalesTarget = require('../database/models/SalesTarget');
const User = require('../database/models/User');

const checkSalesTargetOrders = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Find Usman Abid
    const usman = await User.findOne({ 
      $or: [
        { email: { $regex: /usman/i } },
        { name: { $regex: /usman/i } }
      ]
    });

    if (!usman) {
      console.error('❌ Usman Abid not found in users');
      process.exit(1);
    }

    console.log(`👤 Found User: ${usman.name} (${usman.email})\n`);
    console.log(`   User ID: ${usman._id}\n`);

    // Find active target for Usman
    const target = await SalesTarget.findOne({
      salesman: usman._id,
      status: 'Active'
    }).populate('salesman', 'name email');

    if (!target) {
      console.error('❌ No active sales target found for Usman');
      process.exit(1);
    }

    console.log(`🎯 Sales Target Found:\n`);
    console.log(`   Target: ${target.targetName}`);
    console.log(`   Period: ${new Date(target.startDate).toLocaleDateString()} - ${new Date(target.endDate).toLocaleDateString()}`);
    console.log(`   Target Value: ${target.targetValue} orders`);
    console.log(`   Current Progress: ${target.currentProgress} orders\n`);

    const startDate = new Date(target.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(target.endDate);
    endDate.setHours(23, 59, 59, 999);

    console.log(`📅 Target Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);

    // Get ALL orders for Usman (any status)
    const allUsmanOrders = await SalesOrder.find({
      salesPerson: usman._id
    })
    .populate('salesPerson', 'name email')
    .sort({ orderDate: -1 });

    console.log(`📦 Total Orders for Usman: ${allUsmanOrders.length}\n`);

    // Check each order
    const countedStatuses = ['Confirmed', 'Processing', 'Dispatched', 'Delivered'];
    let countedOrders = 0;
    let notCountedReasons = {
      wrongStatus: [],
      outsideDateRange: [],
      correct: []
    };

    allUsmanOrders.forEach((order) => {
      const orderDate = new Date(order.orderDate);
      const isInDateRange = orderDate >= startDate && orderDate <= endDate;
      const hasCountedStatus = countedStatuses.includes(order.orderStatus);

      if (hasCountedStatus && isInDateRange) {
        countedOrders++;
        notCountedReasons.correct.push({
          soNumber: order.soNumber,
          orderStatus: order.orderStatus,
          orderDate: orderDate.toLocaleDateString(),
          grandTotal: order.grandTotal
        });
      } else {
        if (!hasCountedStatus) {
          notCountedReasons.wrongStatus.push({
            soNumber: order.soNumber,
            orderStatus: order.orderStatus,
            orderDate: orderDate.toLocaleDateString(),
            grandTotal: order.grandTotal
          });
        }
        if (!isInDateRange) {
          notCountedReasons.outsideDateRange.push({
            soNumber: order.soNumber,
            orderStatus: order.orderStatus,
            orderDate: orderDate.toLocaleDateString(),
            grandTotal: order.grandTotal
          });
        }
      }
    });

    console.log(`✅ Orders that SHOULD be counted: ${countedOrders}\n`);
    if (notCountedReasons.correct.length > 0) {
      console.log('   These orders match all criteria:\n');
      notCountedReasons.correct.forEach((o, i) => {
        console.log(`   ${i + 1}. ${o.soNumber} - ${o.orderStatus} - ${o.orderDate} - £${o.grandTotal}`);
      });
      console.log('');
    }

    console.log(`❌ Orders NOT counted (wrong status): ${notCountedReasons.wrongStatus.length}\n`);
    if (notCountedReasons.wrongStatus.length > 0) {
      notCountedReasons.wrongStatus.forEach((o, i) => {
        console.log(`   ${i + 1}. ${o.soNumber} - Status: ${o.orderStatus} (needs: Confirmed/Processing/Dispatched/Delivered) - Date: ${o.orderDate}`);
      });
      console.log('');
    }

    console.log(`❌ Orders NOT counted (outside date range): ${notCountedReasons.outsideDateRange.length}\n`);
    if (notCountedReasons.outsideDateRange.length > 0) {
      notCountedReasons.outsideDateRange.forEach((o, i) => {
        const orderDate = new Date(o.orderDate);
        const isBefore = orderDate < startDate;
        const isAfter = orderDate > endDate;
        const reason = isBefore ? 'BEFORE target start' : isAfter ? 'AFTER target end' : 'UNKNOWN';
        console.log(`   ${i + 1}. ${o.soNumber} - ${o.orderStatus} - ${o.orderDate} - ${reason}`);
      });
      console.log('');
    }

    // Check specific orders from user's list
    const specificSOs = [
      'SO278843', 'SO783526', 'SO507356', 'SO139379', 'SO265257',
      'SO103290', 'SO480968', 'SO699677', 'SO102900', 'SO194265',
      'SO493923', 'SO238125', 'SO816851', 'SO243253'
    ];

    console.log(`\n🔍 Checking specific orders from your list:\n`);
    for (const soNumber of specificSOs) {
      const order = await SalesOrder.findOne({ soNumber })
        .populate('salesPerson', 'name email');
      
      if (!order) {
        console.log(`   ❌ ${soNumber} - NOT FOUND in database`);
        continue;
      }

      const orderDate = new Date(order.orderDate);
      const isInDateRange = orderDate >= startDate && orderDate <= endDate;
      const hasCountedStatus = countedStatuses.includes(order.orderStatus);
      const isUsmanOrder = order.salesPerson && order.salesPerson._id.toString() === usman._id.toString();

      console.log(`   📦 ${soNumber}:`);
      console.log(`      - Sales Person: ${order.salesPerson ? order.salesPerson.name : 'N/A'} (${isUsmanOrder ? '✅ Usman' : '❌ Not Usman'})`);
      console.log(`      - Status: ${order.orderStatus} (${hasCountedStatus ? '✅ Counted' : '❌ Not Counted'})`);
      console.log(`      - Order Date: ${orderDate.toLocaleDateString()} (${isInDateRange ? '✅ In Range' : '❌ Outside Range'})`);
      console.log(`      - Will Count: ${isUsmanOrder && hasCountedStatus && isInDateRange ? '✅ YES' : '❌ NO'}`);
      console.log('');
    }

    // Recalculate using same logic as backend
    const recalculatedCount = await SalesOrder.countDocuments({
      salesPerson: target.salesman,
      orderStatus: { $in: ['Confirmed', 'Processing', 'Dispatched', 'Delivered'] },
      orderDate: { $gte: startDate, $lte: endDate }
    });

    console.log(`\n🔢 Backend calculation result: ${recalculatedCount} orders\n`);
    console.log(`   Target shows: ${target.currentProgress} orders\n`);
    
    if (recalculatedCount !== target.currentProgress) {
      console.log(`   ⚠️ MISMATCH! Backend should show ${recalculatedCount} but target shows ${target.currentProgress}`);
      console.log(`   💡 Run GET /api/admin/sales-targets to refresh progress\n`);
    } else {
      console.log(`   ✅ Progress matches backend calculation\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  checkSalesTargetOrders();
}

module.exports = checkSalesTargetOrders;
