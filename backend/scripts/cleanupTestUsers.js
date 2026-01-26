/**
 * Cleanup Test Users Script
 * Removes or renames "Test User API" test users
 * Usage: node backend/scripts/cleanupTestUsers.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const User = require('../database/models/User');

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

function logStep(message) {
  log(`\n${'='.repeat(70)}`, 'blue');
  log(`📋 ${message}`, 'magenta');
  log('='.repeat(70), 'blue');
}

// Main function
async function main() {
  log('\n' + '='.repeat(70), 'blue');
  log('🧹 Cleanup Test Users - "Test User API"', 'magenta');
  log('='.repeat(70), 'blue');
  log('');

  try {
    // Connect to database
    logStep('Connecting to Database');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // Find all "Test User API" users
    logStep('Finding Test Users');
    const testUsers = await User.find({
      $or: [
        { name: { $regex: /test.*user.*api/i } },
        { name: 'Test User API' },
        { email: { $regex: /testuser.*@test\.com/i } }
      ]
    });

    if (testUsers.length === 0) {
      logSuccess('No test users found. Nothing to clean up.\n');
      process.exit(0);
    }

    logWarning(`Found ${testUsers.length} test user(s):`);
    testUsers.forEach((user, index) => {
      log(`  ${index + 1}. ${user.name} (${user.email}) - ${user.role} - ${user.status}`, 'yellow');
    });
    log('');

    // Ask what to do (for now, just report - user can decide)
    logStep('Test Users Found');
    logInfo('These are test users that were created during testing.');
    logInfo('Options:');
    logInfo('  1. Delete them (if not needed)');
    logInfo('  2. Rename them (if they are real users)');
    logInfo('  3. Deactivate them (set status to Inactive)\n');

    logWarning('To delete test users, uncomment the deletion code in this script.');
    logWarning('To rename them, uncomment the rename code in this script.\n');

    // Option 1: Delete test users (commented out for safety)
    /*
    logStep('Deleting Test Users');
    let deletedCount = 0;
    for (const user of testUsers) {
      try {
        await User.findByIdAndDelete(user._id);
        deletedCount++;
        logSuccess(`Deleted: ${user.name} (${user.email})`);
      } catch (error) {
        logError(`Failed to delete ${user.name}:`, error);
      }
    }
    logSuccess(`\nDeleted ${deletedCount} test user(s)\n`);
    */

    // Option 2: Rename test users (commented out for safety)
    /*
    logStep('Renaming Test Users');
    let renamedCount = 0;
    for (const user of testUsers) {
      try {
        user.name = `Test User ${user._id.toString().substring(0, 8)}`;
        await user.save();
        renamedCount++;
        logSuccess(`Renamed: ${user.email} -> ${user.name}`);
      } catch (error) {
        logError(`Failed to rename ${user.email}:`, error);
      }
    }
    logSuccess(`\nRenamed ${renamedCount} test user(s)\n`);
    */

    // Option 3: Deactivate test users (commented out for safety)
    /*
    logStep('Deactivating Test Users');
    let deactivatedCount = 0;
    for (const user of testUsers) {
      try {
        user.status = 'Inactive';
        await user.save();
        deactivatedCount++;
        logSuccess(`Deactivated: ${user.name} (${user.email})`);
      } catch (error) {
        logError(`Failed to deactivate ${user.name}:`, error);
      }
    }
    logSuccess(`\nDeactivated ${deactivatedCount} test user(s)\n`);
    */

    logSuccess('Investigation complete!');
    logInfo('Review the test users above and decide what action to take.');
    logInfo('Uncomment the appropriate section in the script to perform the action.\n');

    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    process.exit(1);
  }
}

// Run the script
main();
