/**
 * Assign Visits to Salesman Script
 * 
 * Creates multiple visit targets and assigns them to a salesman
 * Some visits have 5 locations (grouped visits)
 * 
 * Usage:
 *   node scripts/assignVisitsToSalesman.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const VisitTarget = require('../database/models/VisitTarget');
const User = require('../database/models/User');
const bcrypt = require('bcryptjs');

// Credentials
const ADMIN_EMAIL = 'talhaabid400@gmail.com';
const ADMIN_PASSWORD = 'Admin@123';
const SALESMAN_EMAIL = 'usman.abid00321@gmail.com';
const SALESMAN_PASSWORD = 'salesman123';

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

// Verify user credentials
async function verifyUser(email, password) {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return null;
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }
    return user;
  } catch (error) {
    logError('Error verifying user', error);
    return null;
  }
}

// Main function
async function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('🚀 Assign Visits to Salesman Script', 'magenta');
  log('='.repeat(60) + '\n', 'blue');

  try {
    // Connect to database
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // Verify users
    log('-'.repeat(60), 'cyan');
    log('🔐 User Verification', 'cyan');
    log('-'.repeat(60), 'cyan');

    const adminUser = await verifyUser(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!adminUser) {
      logError('Failed to verify admin user');
      process.exit(1);
    }
    logSuccess(`Admin verified: ${adminUser.name} (${adminUser.email})`);

    const salesmanUser = await verifyUser(SALESMAN_EMAIL, SALESMAN_PASSWORD);
    if (!salesmanUser) {
      logError('Failed to verify salesman user');
      process.exit(1);
    }
    logSuccess(`Salesman verified: ${salesmanUser.name} (${salesmanUser.email})\n`);

    // Get dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    log('-'.repeat(60), 'cyan');
    log('📍 Creating Visit Targets', 'cyan');
    log('-'.repeat(60), 'cyan');

    const createdVisits = [];

    // Group 1: IOTFIY SOLUTIONS - 5 locations (same company, different addresses)
    logInfo('\nCreating Group 1: IOTFIY SOLUTIONS (5 locations)...');
    const iotfiyLocations = [
      {
        name: 'IOTFIY SOLUTIONS - Main Office',
        address: 'ST-16 Main University Rd, Block 5 Gulshan-e-Iqbal',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75300',
        latitude: 24.9207,
        longitude: 67.0656,
        visitDate: today,
        priority: 'High',
        description: 'Main headquarters of IOTFIY SOLUTIONS'
      },
      {
        name: 'IOTFIY SOLUTIONS - Branch 1',
        address: 'Plot 23, Block 6, PECHS',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75400',
        latitude: 24.9056,
        longitude: 67.0822,
        visitDate: today,
        priority: 'High',
        description: 'First branch location'
      },
      {
        name: 'IOTFIY SOLUTIONS - Branch 2',
        address: 'Shop 45, Tariq Road',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75500',
        latitude: 24.9150,
        longitude: 67.0700,
        visitDate: today,
        priority: 'Medium',
        description: 'Second branch location'
      },
      {
        name: 'IOTFIY SOLUTIONS - Warehouse',
        address: 'Industrial Area, SITE',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75700',
        latitude: 24.9000,
        longitude: 67.0800,
        visitDate: today,
        priority: 'Medium',
        description: 'Warehouse facility'
      },
      {
        name: 'IOTFIY SOLUTIONS - Showroom',
        address: 'Mall Road, Clifton',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75600',
        latitude: 24.8100,
        longitude: 67.0300,
        visitDate: today,
        priority: 'High',
        description: 'Customer showroom'
      }
    ];

    for (const location of iotfiyLocations) {
      const visit = await VisitTarget.create({
        ...location,
        salesman: salesmanUser._id,
        createdBy: adminUser._id,
        status: 'Pending',
        approvalStatus: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        notes: `Assigned by admin for ${location.name}`
      });
      createdVisits.push(visit);
      logSuccess(`Created: ${location.name}`);
    }

    // Group 2: Tech Solutions - 5 locations
    logInfo('\nCreating Group 2: Tech Solutions (5 locations)...');
    const techLocations = [
      {
        name: 'Tech Solutions - Head Office',
        address: '123 Business Park, Phase 1',
        city: 'Lahore',
        state: 'Punjab',
        pincode: '54000',
        latitude: 31.5204,
        longitude: 74.3587,
        visitDate: tomorrow,
        priority: 'High',
        description: 'Main office'
      },
      {
        name: 'Tech Solutions - Development Center',
        address: '456 IT Street, DHA',
        city: 'Lahore',
        state: 'Punjab',
        pincode: '54100',
        latitude: 31.5100,
        longitude: 74.3500,
        visitDate: tomorrow,
        priority: 'High',
        description: 'Development center'
      },
      {
        name: 'Tech Solutions - Sales Office',
        address: '789 Main Boulevard',
        city: 'Lahore',
        state: 'Punjab',
        pincode: '54200',
        latitude: 31.5300,
        longitude: 74.3600,
        visitDate: tomorrow,
        priority: 'Medium',
        description: 'Sales office'
      },
      {
        name: 'Tech Solutions - Support Center',
        address: '321 Service Road',
        city: 'Lahore',
        state: 'Punjab',
        pincode: '54300',
        latitude: 31.5250,
        longitude: 74.3550,
        visitDate: tomorrow,
        priority: 'Medium',
        description: 'Customer support center'
      },
      {
        name: 'Tech Solutions - Retail Outlet',
        address: '654 Market Street',
        city: 'Lahore',
        state: 'Punjab',
        pincode: '54400',
        latitude: 31.5150,
        longitude: 74.3650,
        visitDate: tomorrow,
        priority: 'Low',
        description: 'Retail outlet'
      }
    ];

    for (const location of techLocations) {
      const visit = await VisitTarget.create({
        ...location,
        salesman: salesmanUser._id,
        createdBy: adminUser._id,
        status: 'Pending',
        approvalStatus: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        notes: `Assigned by admin for ${location.name}`
      });
      createdVisits.push(visit);
      logSuccess(`Created: ${location.name}`);
    }

    // Individual visits with different dates
    logInfo('\nCreating individual visits with different dates...');
    const individualVisits = [
      {
        name: 'ABC Corporation',
        address: '100 Corporate Tower, Business District',
        city: 'Islamabad',
        state: 'Islamabad Capital Territory',
        pincode: '44000',
        latitude: 33.6844,
        longitude: 73.0479,
        visitDate: nextWeek,
        priority: 'High',
        description: 'Important client meeting'
      },
      {
        name: 'XYZ Industries',
        address: '200 Factory Road, Industrial Zone',
        city: 'Faisalabad',
        state: 'Punjab',
        pincode: '38000',
        latitude: 31.4504,
        longitude: 73.1350,
        visitDate: nextWeek,
        priority: 'Medium',
        description: 'Factory visit'
      },
      {
        name: 'Global Trading Co.',
        address: '300 Trade Center, Port Area',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '74000',
        latitude: 24.8607,
        longitude: 67.0011,
        visitDate: nextMonth,
        priority: 'High',
        description: 'Trading partner visit'
      },
      {
        name: 'Local Retail Store',
        address: '50 Main Street, Downtown',
        city: 'Rawalpindi',
        state: 'Punjab',
        pincode: '46000',
        latitude: 33.5651,
        longitude: 73.0169,
        visitDate: lastWeek,
        priority: 'Low',
        description: 'Past visit - follow up needed',
        status: 'Pending'
      },
      {
        name: 'Premium Client Office',
        address: '500 Luxury Plaza, Elite Area',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75550',
        latitude: 24.8138,
        longitude: 67.0720,
        visitDate: today,
        priority: 'High',
        description: 'VIP client visit'
      }
    ];

    for (const visitData of individualVisits) {
      const visit = await VisitTarget.create({
        ...visitData,
        salesman: salesmanUser._id,
        createdBy: adminUser._id,
        status: visitData.status || 'Pending',
        approvalStatus: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        notes: `Assigned by admin - ${visitData.description}`
      });
      createdVisits.push(visit);
      logSuccess(`Created: ${visitData.name} (${new Date(visitData.visitDate).toLocaleDateString()})`);
    }

    // Summary
    log('\n' + '='.repeat(60), 'blue');
    log('📊 Summary', 'magenta');
    log('='.repeat(60), 'blue');
    logSuccess(`Total visits created: ${createdVisits.length}`);
    logInfo(`Salesman: ${salesmanUser.name} (${salesmanUser.email})`);
    logInfo(`Assigned by: ${adminUser.name} (${adminUser.email})`);
    
    // Group by date
    const todayCount = createdVisits.filter(v => {
      const vDate = new Date(v.visitDate);
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate()).getTime() === todayOnly.getTime();
    }).length;
    
    const tomorrowCount = createdVisits.filter(v => {
      const vDate = new Date(v.visitDate);
      const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      return new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate()).getTime() === tomorrowOnly.getTime();
    }).length;

    logInfo(`\nDate-wise distribution:`);
    logInfo(`  Today: ${todayCount} visits`);
    logInfo(`  Tomorrow: ${tomorrowCount} visits`);
    logInfo(`  This Week: ${createdVisits.filter(v => {
      const vDate = new Date(v.visitDate);
      return vDate > today && vDate <= nextWeek;
    }).length} visits`);
    logInfo(`  Upcoming: ${createdVisits.filter(v => {
      const vDate = new Date(v.visitDate);
      return vDate > nextWeek;
    }).length} visits`);
    logInfo(`  Past: ${createdVisits.filter(v => {
      const vDate = new Date(v.visitDate);
      return vDate < today;
    }).length} visits`);

    logInfo(`\nGrouped visits:`);
    logInfo(`  IOTFIY SOLUTIONS: 5 locations (all today)`);
    logInfo(`  Tech Solutions: 5 locations (all tomorrow)`);
    logInfo(`  Individual visits: ${individualVisits.length} visits`);

    log('\n' + '='.repeat(60), 'green');
    logSuccess('✅ All visits assigned successfully!');
    log('='.repeat(60) + '\n', 'green');
    logInfo('You can now check the salesman dashboard to see these visits.');
    logInfo('They will appear in the "Assign Visits" modal organized by date.\n');

    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    process.exit(1);
  }
}

// Run the script
main();
