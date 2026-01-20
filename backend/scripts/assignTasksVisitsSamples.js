/**
 * Comprehensive Assignment Script: Tasks, Visits, and Sample Tracks
 * 
 * Creates and assigns:
 *   - Tasks (FollowUp) from admin to salesman
 *   - Visits (VisitTarget) from admin to salesman
 *   - Sample Tracks (Sample) from admin to salesman
 * 
 * Usage:
 *   node scripts/assignTasksVisitsSamples.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const VisitTarget = require('../database/models/VisitTarget');
const Sample = require('../database/models/Sample');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');
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

// Get or create a test customer
async function getOrCreateCustomer(salesmanId, adminId) {
  try {
    let customer = await Customer.findOne({ 
      email: 'testcustomer@example.com',
      assignedSalesman: salesmanId 
    });
    
    if (!customer) {
      customer = await Customer.create({
        name: 'Test Customer Company',
        firstName: 'Test',
        lastName: 'Customer',
        email: 'testcustomer@example.com',
        phone: '+923001234567',
        company: 'Test Company Ltd',
        assignedSalesman: salesmanId,
        createdBy: adminId,
        status: 'Active'
      });
      logSuccess(`Created test customer: ${customer.name}`);
    } else {
      logInfo(`Using existing customer: ${customer.name}`);
    }
    
    return customer;
  } catch (error) {
    logError('Error getting/creating customer', error);
    return null;
  }
}

// Get or create a test product
async function getOrCreateProduct(adminId) {
  try {
    let product = await Product.findOne({ 
      name: 'Test Product Sample',
      isActive: true 
    });
    
    if (!product) {
      product = await Product.create({
        name: 'Test Product Sample',
        productCode: 'TEST-001',
        description: 'Test product for sample tracking',
        price: 1000,
        category: 'Test',
        isActive: true,
        createdBy: adminId
      });
      logSuccess(`Created test product: ${product.name}`);
    } else {
      logInfo(`Using existing product: ${product.name}`);
    }
    
    return product;
  } catch (error) {
    logError('Error getting/creating product', error);
    return null;
  }
}

// Main function
async function main() {
  log('\n' + '='.repeat(70), 'blue');
  log('🚀 Comprehensive Assignment Script: Tasks, Visits & Sample Tracks', 'magenta');
  log('='.repeat(70) + '\n', 'blue');

  try {
    // Connect to database
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // Verify users
    log('-'.repeat(70), 'cyan');
    log('🔐 User Verification', 'cyan');
    log('-'.repeat(70), 'cyan');

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

    // Get or create test customer and product
    log('-'.repeat(70), 'cyan');
    log('👤 Setting up Test Data', 'cyan');
    log('-'.repeat(70), 'cyan');
    
    const customer = await getOrCreateCustomer(salesmanUser._id, adminUser._id);
    if (!customer) {
      logError('Failed to get/create customer');
      process.exit(1);
    }
    
    const product = await getOrCreateProduct(adminUser._id);
    if (!product) {
      logError('Failed to get/create product');
      process.exit(1);
    }
    log('');

    // Get dates
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const createdTasks = [];
    const createdVisits = [];
    const createdSamples = [];

    // ============================================
    // 1. CREATE TASKS (FollowUp)
    // ============================================
    log('-'.repeat(70), 'cyan');
    log('📋 Creating Tasks (FollowUp)', 'cyan');
    log('-'.repeat(70), 'cyan');

    const taskTypes = ['Call', 'Visit', 'Email', 'Quote Follow-up', 'Sample Feedback', 'Order Check'];
    const priorities = ['Low', 'Medium', 'High', 'Urgent'];
    const taskDates = [today, tomorrow, nextWeek, nextMonth, lastWeek];

    for (let i = 0; i < 10; i++) {
      const taskType = taskTypes[i % taskTypes.length];
      const priority = priorities[i % priorities.length];
      const dueDate = taskDates[i % taskDates.length];
      const scheduledDate = new Date(dueDate);
      scheduledDate.setHours(10 + (i % 8), 0, 0, 0);

      // Determine status based on date
      let status = 'Upcoming';
      if (dueDate < today) {
        status = 'Overdue';
      } else if (dueDate.toDateString() === today.toDateString()) {
        status = 'Today';
      }

      try {
        const task = await FollowUp.create({
          salesman: salesmanUser._id,
          customer: customer._id,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          type: taskType,
          priority: priority,
          status: status,
          scheduledDate: scheduledDate,
          dueDate: dueDate,
          description: `Admin assigned ${taskType.toLowerCase()} task for ${customer.name}`,
          notes: `Priority: ${priority}, Assigned by admin on ${new Date().toLocaleDateString()}`,
          approvalStatus: 'Approved', // Admin-created tasks are auto-approved
          createdBy: adminUser._id
        });
        createdTasks.push(task);
        logSuccess(`Task ${i + 1}: ${taskType} - ${customer.name} (Due: ${dueDate.toLocaleDateString()})`);
      } catch (error) {
        logError(`Failed to create task ${i + 1}`, error);
      }
    }

    logInfo(`\nTotal tasks created: ${createdTasks.length}\n`);

    // ============================================
    // 2. CREATE VISITS (VisitTarget)
    // ============================================
    log('-'.repeat(70), 'cyan');
    log('📍 Creating Visits (VisitTarget)', 'cyan');
    log('-'.repeat(70), 'cyan');

    const visitData = [
      {
        name: 'ABC Corporation - Main Office',
        address: '100 Corporate Tower, Business District',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75300',
        latitude: 24.9207,
        longitude: 67.0656,
        visitDate: today,
        priority: 'High',
        description: 'Important client meeting'
      },
      {
        name: 'XYZ Industries - Factory',
        address: '200 Factory Road, Industrial Zone',
        city: 'Lahore',
        state: 'Punjab',
        pincode: '54000',
        latitude: 31.4504,
        longitude: 73.1350,
        visitDate: tomorrow,
        priority: 'High',
        description: 'Factory visit and product demo'
      },
      {
        name: 'Global Trading Co.',
        address: '300 Trade Center, Port Area',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '74000',
        latitude: 24.8607,
        longitude: 67.0011,
        visitDate: nextWeek,
        priority: 'Medium',
        description: 'Trading partner visit'
      },
      {
        name: 'Premium Client Office',
        address: '500 Luxury Plaza, Elite Area',
        city: 'Islamabad',
        state: 'Islamabad Capital Territory',
        pincode: '44000',
        latitude: 33.6844,
        longitude: 73.0479,
        visitDate: today,
        priority: 'High',
        description: 'VIP client visit'
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
        description: 'Past visit - follow up needed'
      }
    ];

    for (const visitInfo of visitData) {
      try {
        const visit = await VisitTarget.create({
          ...visitInfo,
          salesman: salesmanUser._id,
          createdBy: adminUser._id,
          status: 'Pending',
          approvalStatus: 'Approved',
          approvedAt: new Date(),
          approvedBy: adminUser._id,
          notes: `Assigned by admin - ${visitInfo.description}`
        });
        createdVisits.push(visit);
        logSuccess(`Visit: ${visitInfo.name} (Date: ${new Date(visitInfo.visitDate).toLocaleDateString()})`);
      } catch (error) {
        logError(`Failed to create visit: ${visitInfo.name}`, error);
      }
    }

    logInfo(`\nTotal visits created: ${createdVisits.length}\n`);

    // ============================================
    // 3. CREATE SAMPLES (Sample)
    // ============================================
    log('-'.repeat(70), 'cyan');
    log('🧪 Creating Sample Tracks (Sample)', 'cyan');
    log('-'.repeat(70), 'cyan');

    const sampleData = [
      {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        productName: product.name,
        productCode: product.productCode,
        quantity: 2,
        visitDate: today,
        expectedDate: nextWeek,
        notes: 'Sample for testing and evaluation',
        status: 'Pending'
      },
      {
        customerName: 'New Customer ABC',
        customerEmail: 'newcustomer@example.com',
        customerPhone: '+923001111111',
        productName: product.name,
        productCode: product.productCode,
        quantity: 1,
        visitDate: tomorrow,
        expectedDate: nextWeek,
        notes: 'Initial sample for new customer',
        status: 'Pending'
      },
      {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        productName: 'Premium Product X',
        productCode: 'PREMIUM-001',
        quantity: 3,
        visitDate: nextWeek,
        expectedDate: nextMonth,
        notes: 'Premium product sample for VIP customer',
        status: 'Pending'
      },
      {
        customerName: 'Test Company XYZ',
        customerEmail: 'xyz@example.com',
        customerPhone: '+923002222222',
        productName: product.name,
        productCode: product.productCode,
        quantity: 1,
        visitDate: today,
        expectedDate: tomorrow,
        notes: 'Urgent sample request',
        status: 'Pending'
      },
      {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        productName: 'Standard Product Y',
        productCode: 'STD-001',
        quantity: 2,
        visitDate: lastWeek,
        expectedDate: today,
        notes: 'Follow-up sample after previous visit',
        status: 'Pending'
      }
    ];

    for (const sampleInfo of sampleData) {
      try {
        const sample = await Sample.create({
          salesman: salesmanUser._id,
          customer: customer._id,
          customerName: sampleInfo.customerName,
          customerEmail: sampleInfo.customerEmail,
          customerPhone: sampleInfo.customerPhone,
          product: product._id,
          productName: sampleInfo.productName,
          productCode: sampleInfo.productCode,
          quantity: sampleInfo.quantity,
          visitDate: sampleInfo.visitDate,
          expectedDate: sampleInfo.expectedDate,
          notes: sampleInfo.notes,
          status: sampleInfo.status,
          createdBy: adminUser._id
        });
        createdSamples.push(sample);
        logSuccess(`Sample: ${sampleInfo.productName} for ${sampleInfo.customerName} (Qty: ${sampleInfo.quantity})`);
      } catch (error) {
        logError(`Failed to create sample: ${sampleInfo.productName}`, error);
      }
    }

    logInfo(`\nTotal samples created: ${createdSamples.length}\n`);

    // ============================================
    // SUMMARY
    // ============================================
    log('\n' + '='.repeat(70), 'blue');
    log('📊 Summary', 'magenta');
    log('='.repeat(70), 'blue');
    
    logSuccess(`Total Tasks Created: ${createdTasks.length}`);
    logSuccess(`Total Visits Created: ${createdVisits.length}`);
    logSuccess(`Total Samples Created: ${createdSamples.length}`);
    
    logInfo(`\nSalesman: ${salesmanUser.name} (${salesmanUser.email})`);
    logInfo(`Assigned by: ${adminUser.name} (${adminUser.email})`);
    logInfo(`Customer: ${customer.name} (${customer.email})`);
    logInfo(`Product: ${product.name} (${product.productCode})`);

    // Task breakdown
    logInfo(`\n📋 Tasks Breakdown:`);
    const taskByType = {};
    createdTasks.forEach(t => {
      taskByType[t.type] = (taskByType[t.type] || 0) + 1;
    });
    Object.entries(taskByType).forEach(([type, count]) => {
      logInfo(`  ${type}: ${count}`);
    });

    const taskByStatus = {};
    createdTasks.forEach(t => {
      taskByStatus[t.status] = (taskByStatus[t.status] || 0) + 1;
    });
    logInfo(`\n  By Status:`);
    Object.entries(taskByStatus).forEach(([status, count]) => {
      logInfo(`  ${status}: ${count}`);
    });

    // Visit breakdown
    logInfo(`\n📍 Visits Breakdown:`);
    const visitByDate = {
      today: 0,
      tomorrow: 0,
      thisWeek: 0,
      upcoming: 0,
      past: 0
    };
    createdVisits.forEach(v => {
      const vDate = new Date(v.visitDate);
      if (vDate.toDateString() === today.toDateString()) {
        visitByDate.today++;
      } else if (vDate.toDateString() === tomorrow.toDateString()) {
        visitByDate.tomorrow++;
      } else if (vDate > today && vDate <= nextWeek) {
        visitByDate.thisWeek++;
      } else if (vDate > nextWeek) {
        visitByDate.upcoming++;
      } else {
        visitByDate.past++;
      }
    });
    logInfo(`  Today: ${visitByDate.today}`);
    logInfo(`  Tomorrow: ${visitByDate.tomorrow}`);
    logInfo(`  This Week: ${visitByDate.thisWeek}`);
    logInfo(`  Upcoming: ${visitByDate.upcoming}`);
    logInfo(`  Past: ${visitByDate.past}`);

    // Sample breakdown
    logInfo(`\n🧪 Samples Breakdown:`);
    logInfo(`  Product: ${product.name} (${createdSamples.filter(s => s.productName === product.name).length} samples)`);
    logInfo(`  Status: All Pending (${createdSamples.length} samples)`);

    log('\n' + '='.repeat(70), 'green');
    logSuccess('✅ All assignments completed successfully!');
    log('='.repeat(70) + '\n', 'green');
    
    logInfo('📱 Salesman Dashboard:');
    logInfo('  - Tasks will appear in the Tasks page');
    logInfo('  - Visits will appear in Sales Tracking > Assign Visits modal');
    logInfo('  - Samples will appear in Sample Track section');
    logInfo('\n💡 All items are assigned from admin and ready for salesman to view and work on.\n');

    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
