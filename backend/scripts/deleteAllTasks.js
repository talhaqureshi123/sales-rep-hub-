/**
 * Delete All Tasks Script
 * 
 * Deletes all tasks (FollowUp) from the database
 * 
 * Usage:
 *   node scripts/deleteAllTasks.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message, error = null) {
  log(`❌ ${message}`, 'red');
  if (error) {
    log(`   Error: ${error.message}`, 'red');
  }
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Main function
async function main() {
  log('\n' + '='.repeat(70), 'blue');
  log('🗑️  Delete All Tasks Script', 'magenta');
  log('='.repeat(70) + '\n', 'blue');

  try {
    // Connect to database
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // Count tasks before deletion
    const taskCount = await FollowUp.countDocuments();
    logInfo(`Total tasks found: ${taskCount}`);

    if (taskCount === 0) {
      logInfo('No tasks to delete. Database is already clean.\n');
      process.exit(0);
    }

    // Delete all tasks
    log('-'.repeat(70), 'cyan');
    log('📋 Deleting All Tasks', 'cyan');
    log('-'.repeat(70), 'cyan');

    const deleteResult = await FollowUp.deleteMany({});
    logSuccess(`Deleted ${deleteResult.deletedCount} tasks`);

    // Verify deletion
    const remainingCount = await FollowUp.countDocuments();
    if (remainingCount === 0) {
      logSuccess('\n✅ All tasks deleted successfully!');
    } else {
      logWarning(`\n⚠️  Warning: ${remainingCount} tasks still remain`);
    }

    log('\n' + '='.repeat(70), 'green');
    logSuccess('✅ Cleanup completed!');
    log('='.repeat(70) + '\n', 'green');

    logInfo('💡 You can now import tasks from HubSpot.\n');

    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
