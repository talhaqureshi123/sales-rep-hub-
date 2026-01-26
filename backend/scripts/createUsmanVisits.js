/**
 * Create 4 visits for today for Usman Abid with Karachi locations
 * Usage: node backend/scripts/createUsmanVisits.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const VisitTarget = require('../database/models/VisitTarget');
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

// Main function
async function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('🚀 Create Visits for Usman Abid - Karachi', 'magenta');
  log('='.repeat(60) + '\n', 'blue');

  try {
    // Connect to database
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // Find Usman Abid user
    log('-'.repeat(60), 'cyan');
    log('🔍 Finding Usman Abid User', 'cyan');
    log('-'.repeat(60), 'cyan');

    const salesmanUser = await User.findOne({ 
      email: 'usman.abid00321@gmail.com' 
    });

    if (!salesmanUser) {
      logError('Usman Abid user not found. Please create the user first.');
      process.exit(1);
    }
    logSuccess(`User found: ${salesmanUser.name} (${salesmanUser.email})\n`);

    // Find or create admin user
    let adminUser = await User.findOne({ 
      email: 'talhaabid400@gmail.com',
      role: 'admin'
    });

    if (!adminUser) {
      logInfo('Admin user not found, using salesman as creator...');
      adminUser = salesmanUser;
    } else {
      logSuccess(`Admin found: ${adminUser.name} (${adminUser.email})\n`);
    }

    // Get today's date (set to start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    log('-'.repeat(60), 'cyan');
    log('📍 Creating 4 Visits for Today - Karachi', 'cyan');
    log('-'.repeat(60), 'cyan');

    // Karachi locations for 4 visits
    const karachiVisits = [
      {
        name: 'Karachi Visit 1 - Clifton Office',
        address: 'Block 9, Clifton, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75600',
        latitude: 24.8138,
        longitude: 67.0720,
        visitDate: today,
        priority: 'High',
        description: 'Clifton area office visit',
        status: 'Pending'
      },
      {
        name: 'Karachi Visit 2 - DHA Branch',
        address: 'DHA Phase 5, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75500',
        latitude: 24.8607,
        longitude: 67.0011,
        visitDate: today,
        priority: 'High',
        description: 'DHA branch visit',
        status: 'Pending'
      },
      {
        name: 'Karachi Visit 3 - Gulshan Office',
        address: 'Gulshan-e-Iqbal, Block 5, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75300',
        latitude: 24.9207,
        longitude: 67.0656,
        visitDate: today,
        priority: 'Medium',
        description: 'Gulshan office visit',
        status: 'Pending'
      },
      {
        name: 'Karachi Visit 4 - PECHS Showroom',
        address: 'PECHS Block 6, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75400',
        latitude: 24.9056,
        longitude: 67.0822,
        visitDate: today,
        priority: 'Medium',
        description: 'PECHS showroom visit',
        status: 'Pending'
      }
    ];

    const createdVisits = [];

    for (const visitData of karachiVisits) {
      const visit = await VisitTarget.create({
        ...visitData,
        salesman: salesmanUser._id,
        createdBy: adminUser._id,
        approvalStatus: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        notes: `Created for Usman Abid - ${visitData.description}`
      });
      createdVisits.push(visit);
      logSuccess(`Created: ${visitData.name} (${visitData.address})`);
    }

    // Summary
    log('\n' + '='.repeat(60), 'blue');
    log('📊 Summary', 'magenta');
    log('='.repeat(60), 'blue');
    logSuccess(`Total visits created: ${createdVisits.length}`);
    logInfo(`Salesman: ${salesmanUser.name} (${salesmanUser.email})`);
    logInfo(`Visit Date: ${today.toLocaleDateString()}`);
    logInfo(`All visits are in Karachi, Sindh`);

    log('\n' + '='.repeat(60), 'green');
    logSuccess('✅ All visits created successfully!');
    log('='.repeat(60) + '\n', 'green');
    logInfo('You can now check the salesman dashboard to see these visits.\n');

    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    process.exit(1);
  }
}

// Run the script
main();
