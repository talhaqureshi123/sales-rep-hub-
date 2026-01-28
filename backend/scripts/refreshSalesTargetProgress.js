/**
 * Refresh sales target progress for all active targets
 * Usage: node backend/scripts/refreshSalesTargetProgress.js
 */

const connectDB = require('../database/connection');
const SalesTarget = require('../database/models/SalesTarget');
const SalesOrder = require('../database/models/SalesOrder');
const User = require('../database/models/User'); // Required for populate

const calculateProgress = async (target) => {
  const startDate = new Date(target.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(target.endDate);
  endDate.setHours(23, 59, 59, 999);
  
  if (target.targetType === 'Orders') {
    const orderCount = await SalesOrder.countDocuments({
      salesPerson: target.salesman,
      orderStatus: { $in: ['Confirmed', 'Processing', 'Dispatched', 'Delivered'] },
      orderDate: { $gte: startDate, $lte: endDate }
    });
    return orderCount;
  }
  return 0;
};

const refreshSalesTargetProgress = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Get all active targets
    const targets = await SalesTarget.find({ status: 'Active' })
      .populate('salesman', 'name email');

    console.log(`📊 Found ${targets.length} active sales targets\n`);

    for (const target of targets) {
      const oldProgress = target.currentProgress;
      const newProgress = await calculateProgress(target);
      
      if (oldProgress !== newProgress) {
        target.currentProgress = newProgress;
        await target.save();
        console.log(`✅ Updated: ${target.salesman?.name || 'N/A'} - ${target.targetName}`);
        console.log(`   Progress: ${oldProgress} → ${newProgress} orders`);
        console.log(`   Period: ${new Date(target.startDate).toLocaleDateString()} - ${new Date(target.endDate).toLocaleDateString()}\n`);
      } else {
        console.log(`✓ No change: ${target.salesman?.name || 'N/A'} - ${target.targetName} (${newProgress} orders)\n`);
      }
    }

    console.log('✅ All targets refreshed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  refreshSalesTargetProgress();
}

module.exports = refreshSalesTargetProgress;
