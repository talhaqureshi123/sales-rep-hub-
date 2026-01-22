/**
 * Delete App-Created Tasks Script
 * Deletes all tasks that were created in the app (not imported from HubSpot)
 * Keeps only HubSpot-imported tasks (tasks with hubspotTaskId)
 * 
 * Usage: node scripts/deleteAppCreatedTasks.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');

// Logging helpers
const logInfo = (msg) => console.log(`ℹ️  ${msg}`);
const logSuccess = (msg) => console.log(`✅ ${msg}`);
const logError = (msg) => console.error(`❌ ${msg}`);
const logWarning = (msg) => console.warn(`⚠️  ${msg}`);

async function main() {
  try {
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected');

    // Count total tasks
    const totalTasks = await FollowUp.countDocuments();
    logInfo(`Total tasks in database: ${totalTasks}`);

    // Count HubSpot tasks (have hubspotTaskId)
    const hubspotTasks = await FollowUp.countDocuments({
      hubspotTaskId: { $exists: true, $ne: null, $ne: '' }
    });
    logInfo(`HubSpot-imported tasks: ${hubspotTasks}`);

    // Count app-created tasks (no hubspotTaskId)
    const appCreatedTasks = await FollowUp.countDocuments({
      $or: [
        { hubspotTaskId: { $exists: false } },
        { hubspotTaskId: null },
        { hubspotTaskId: '' }
      ]
    });
    logInfo(`App-created tasks (will be deleted): ${appCreatedTasks}`);

    if (appCreatedTasks === 0) {
      logWarning('No app-created tasks found. Nothing to delete.');
      process.exit(0);
    }

    // Delete app-created tasks
    logInfo('Deleting app-created tasks...');
    const deleteResult = await FollowUp.deleteMany({
      $or: [
        { hubspotTaskId: { $exists: false } },
        { hubspotTaskId: null },
        { hubspotTaskId: '' }
      ]
    });

    logSuccess(`Deleted ${deleteResult.deletedCount} app-created task(s)`);

    // Verify remaining tasks
    const remainingTasks = await FollowUp.countDocuments();
    logInfo(`Remaining tasks in database: ${remainingTasks} (all should be HubSpot-imported)`);

    // Show summary
    console.log('\n📊 Summary:');
    console.log(`   Total tasks before: ${totalTasks}`);
    console.log(`   HubSpot tasks (kept): ${hubspotTasks}`);
    console.log(`   App-created tasks (deleted): ${deleteResult.deletedCount}`);
    console.log(`   Remaining tasks: ${remainingTasks}\n`);

    logSuccess('Script completed successfully');
    process.exit(0);
  } catch (error) {
    logError(`Script failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
