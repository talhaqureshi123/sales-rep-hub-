/**
 * Test Script: Check "Test User API" Salesman Issue
 * Usage: node backend/scripts/testSalesmanDisplay.js
 * 
 * This script checks:
 * 1. What customers have assignedSalesman field
 * 2. What salesman "Test User API" is
 * 3. Fixes or reports the issue
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const Customer = require('../database/models/Customer');
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
  log('🔍 Test Salesman Display - "Test User API" Investigation', 'magenta');
  log('='.repeat(70), 'blue');
  log('');

  try {
    // Connect to database
    logStep('Connecting to Database');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // Step 1: Find "Test User API" user
    logStep('Step 1: Finding "Test User API" User');
    const testUser = await User.findOne({
      $or: [
        { name: { $regex: /test.*user.*api/i } },
        { email: { $regex: /test.*user.*api/i } },
        { name: 'Test User API' },
        { email: 'testuserapi@example.com' }
      ]
    });

    if (testUser) {
      logSuccess(`Found user: ${testUser.name} (${testUser.email})`);
      logInfo(`Role: ${testUser.role}`);
      logInfo(`Status: ${testUser.status}`);
      logInfo(`ID: ${testUser._id}\n`);
    } else {
      logWarning('"Test User API" user not found in User collection\n');
    }

    // Step 2: Check all users with "test" in name or email
    logStep('Step 2: Finding All Test Users');
    const testUsers = await User.find({
      $or: [
        { name: { $regex: /test/i } },
        { email: { $regex: /test/i } }
      ]
    }).select('name email role status');

    if (testUsers.length > 0) {
      logInfo(`Found ${testUsers.length} test users:`);
      testUsers.forEach((user, index) => {
        log(`  ${index + 1}. ${user.name} (${user.email}) - ${user.role} - ${user.status}`, 'cyan');
      });
      log('');
    } else {
      logWarning('No test users found\n');
    }

    // Step 3: Check customers with assignedSalesman (even though field is removed)
    logStep('Step 3: Checking Customers for assignedSalesman Field');
    
    // Use raw MongoDB query to check if assignedSalesman field exists
    const customersWithSalesman = await Customer.find({
      assignedSalesman: { $exists: true, $ne: null }
    }).limit(10);

    if (customersWithSalesman.length > 0) {
      logWarning(`Found ${customersWithSalesman.length} customers with assignedSalesman field (field should not exist)`);
      logInfo('Sample customers:');
      customersWithSalesman.slice(0, 5).forEach((customer, index) => {
        log(`  ${index + 1}. ${customer.firstName || customer.name} - assignedSalesman: ${customer.assignedSalesman}`, 'yellow');
      });
      log('');
    } else {
      logSuccess('No customers found with assignedSalesman field (correct - field was removed)\n');
    }

    // Step 4: Check customers that might be showing "Test User API"
    logStep('Step 4: Checking Customers Displaying "Test User API"');
    
    // Get customers that might be linked to test users
    const allCustomers = await Customer.find({}).limit(20);
    logInfo(`Checking first ${allCustomers.length} customers...`);
    
    let customersWithTestSalesman = 0;
    for (const customer of allCustomers) {
      // Check if customer has assignedSalesman in raw data
      const customerDoc = customer.toObject();
      if (customerDoc.assignedSalesman) {
        customersWithTestSalesman++;
        try {
          const salesman = await User.findById(customerDoc.assignedSalesman);
          if (salesman && (salesman.name.includes('Test') || salesman.email.includes('test'))) {
            logWarning(`Customer "${customer.firstName || customer.name}" has test salesman: ${salesman.name} (${salesman.email})`);
          }
        } catch (err) {
          logWarning(`Customer "${customer.firstName || customer.name}" has invalid assignedSalesman ID: ${customerDoc.assignedSalesman}`);
        }
      }
    }

    if (customersWithTestSalesman === 0) {
      logSuccess('No customers found with assignedSalesman field\n');
    } else {
      logInfo(`Total customers with assignedSalesman: ${customersWithTestSalesman}\n`);
    }

    // Step 5: Summary and Recommendations
    logStep('Summary and Recommendations');
    
    if (testUser) {
      logWarning('"Test User API" user exists in database');
      logInfo('Recommendation: This might be a test user that should be removed or renamed');
      logInfo(`User ID: ${testUser._id}`);
      logInfo(`User Name: ${testUser.name}`);
      logInfo(`User Email: ${testUser.email}\n`);
    }

    if (customersWithSalesman.length > 0) {
      logWarning('Some customers still have assignedSalesman field');
      logInfo('Recommendation: These customers have old data. The field was removed from the model.');
      logInfo('The frontend should not display assignedSalesman for customers.\n');
    }

    logSuccess('Investigation complete!');
    logInfo('If "Test User API" is showing, it might be:');
    logInfo('  1. A test user in the database');
    logInfo('  2. Old customer data with assignedSalesman field');
    logInfo('  3. Frontend trying to display removed assignedSalesman field\n');

    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    process.exit(1);
  }
}

// Run the script
main();
