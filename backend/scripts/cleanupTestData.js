/**
 * Cleanup Script: Remove All App-Created Test Data
 * 
 * Removes:
 *   - All Tasks (FollowUp)
 *   - All Customers (test customers)
 *   - All Visits (VisitTarget)
 *   - All Samples (Sample)
 * 
 * Usage:
 *   node scripts/cleanupTestData.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const VisitTarget = require('../database/models/VisitTarget');
const Sample = require('../database/models/Sample');
const Customer = require('../database/models/Customer');

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
  log('🧹 Cleanup Script: Remove All App-Created Test Data', 'magenta');
  log('='.repeat(70) + '\n', 'blue');

  try {
    // Connect to database
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // ============================================
    // 1. DELETE ALL TASKS (FollowUp)
    // ============================================
    log('-'.repeat(70), 'cyan');
    log('📋 Deleting All Tasks (FollowUp)', 'cyan');
    log('-'.repeat(70), 'cyan');

    const taskCount = await FollowUp.countDocuments();
    logInfo(`Total tasks found: ${taskCount}`);

    if (taskCount > 0) {
      const deleteResult = await FollowUp.deleteMany({});
      logSuccess(`Deleted ${deleteResult.deletedCount} tasks`);
    } else {
      logInfo('No tasks to delete');
    }
    log('');

    // ============================================
    // 2. DELETE ALL VISITS (VisitTarget)
    // ============================================
    log('-'.repeat(70), 'cyan');
    log('📍 Deleting All Visits (VisitTarget)', 'cyan');
    log('-'.repeat(70), 'cyan');

    const visitCount = await VisitTarget.countDocuments();
    logInfo(`Total visits found: ${visitCount}`);

    if (visitCount > 0) {
      const deleteResult = await VisitTarget.deleteMany({});
      logSuccess(`Deleted ${deleteResult.deletedCount} visits`);
    } else {
      logInfo('No visits to delete');
    }
    log('');

    // ============================================
    // 3. DELETE ALL SAMPLES (Sample)
    // ============================================
    log('-'.repeat(70), 'cyan');
    log('🧪 Deleting All Samples (Sample)', 'cyan');
    log('-'.repeat(70), 'cyan');

    const sampleCount = await Sample.countDocuments();
    logInfo(`Total samples found: ${sampleCount}`);

    if (sampleCount > 0) {
      const deleteResult = await Sample.deleteMany({});
      logSuccess(`Deleted ${deleteResult.deletedCount} samples`);
    } else {
      logInfo('No samples to delete');
    }
    log('');

    // ============================================
    // 4. DELETE ALL TEST CUSTOMERS
    // ============================================
    log('-'.repeat(70), 'cyan');
    log('👤 Deleting All Test Customers', 'cyan');
    log('-'.repeat(70), 'cyan');

    // Delete customers with test email patterns
    const testEmailPatterns = [
      /testcustomer@example\.com/i,
      /newcustomer@example\.com/i,
      /xyz@example\.com/i,
      /test@example\.com/i
    ];

    let totalCustomersDeleted = 0;

    for (const pattern of testEmailPatterns) {
      const customers = await Customer.find({ email: pattern });
      if (customers.length > 0) {
        const deleteResult = await Customer.deleteMany({ email: pattern });
        totalCustomersDeleted += deleteResult.deletedCount;
        logSuccess(`Deleted ${deleteResult.deletedCount} customers matching pattern: ${pattern}`);
      }
    }

    // Also delete customers with "Test" in name or company
    const testNameCustomers = await Customer.find({
      $or: [
        { name: /test/i },
        { company: /test/i },
        { firstName: /test/i },
        { lastName: /test/i }
      ]
    });

    if (testNameCustomers.length > 0) {
      const testCustomerIds = testNameCustomers.map(c => c._id);
      const deleteResult = await Customer.deleteMany({
        _id: { $in: testCustomerIds }
      });
      totalCustomersDeleted += deleteResult.deletedCount;
      logSuccess(`Deleted ${deleteResult.deletedCount} customers with "Test" in name/company`);
    }

    if (totalCustomersDeleted === 0) {
      logInfo('No test customers to delete');
    }

    log('');

    // ============================================
    // SUMMARY
    // ============================================
    log('\n' + '='.repeat(70), 'blue');
    log('📊 Cleanup Summary', 'magenta');
    log('='.repeat(70), 'blue');

    const finalTaskCount = await FollowUp.countDocuments();
    const finalVisitCount = await VisitTarget.countDocuments();
    const finalSampleCount = await Sample.countDocuments();
    const finalCustomerCount = await Customer.countDocuments();

    logInfo(`Remaining Tasks: ${finalTaskCount}`);
    logInfo(`Remaining Visits: ${finalVisitCount}`);
    logInfo(`Remaining Samples: ${finalSampleCount}`);
    logInfo(`Remaining Customers: ${finalCustomerCount}`);

    log('\n' + '='.repeat(70), 'green');
    logSuccess('✅ Cleanup completed successfully!');
    log('='.repeat(70) + '\n', 'green');

    logInfo('💡 All test data has been removed. Database is now clean.');
    logInfo('💡 You can now run the assignment script to create fresh test data.\n');

    process.exit(0);
  } catch (error) {
    logError('Cleanup script failed', error);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
