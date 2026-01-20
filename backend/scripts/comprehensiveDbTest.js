/**
 * Comprehensive Database-Direct Test Script
 * 
 * Tests ALL Admin and Salesman functionality directly using database and models
 * NO HTTP API calls - Direct database access only
 * 
 * Usage:
 *   node scripts/comprehensiveDbTest.js
 * 
 * This script tests:
 *   - User Authentication (bcrypt verification)
 *   - Admin Follow-Up (Tasks) - All CRUD operations
 *   - Salesman Follow-Up (Tasks) - All CRUD operations
 *   - Task Approval/Rejection
 *   - Task Statistics
 *   - Task Filtering
 *   - HubSpot Integration (if configured)
 *   - Sales Orders
 *   - Customers
 *   - Products
 *   - Sales Targets
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');
const SalesOrder = require('../database/models/SalesOrder');
const SalesTarget = require('../database/models/SalesTarget');
const bcrypt = require('bcryptjs');
const hubspotService = require('../services/hubspotService');
const hubspotOAuthService = require('../services/hubspotOAuthService');
const config = require('../config');

// Credentials
const ADMIN_EMAIL = 'talhaabid400@gmail.com';
const ADMIN_PASSWORD = 'Admin@123';
const SALESMAN_EMAIL = 'usman.abid00321@gmail.com';
const SALESMAN_PASSWORD = 'salesman123';

// Test Results
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: []
};

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
  testResults.passed++;
  testResults.total++;
}

function logError(message, error = null) {
  log(`❌ ${message}`, 'red');
  testResults.failed++;
  testResults.total++;
  if (error) {
    testResults.errors.push({ message, error: error.message || error });
  }
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logSection(message) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`📋 ${message}`, 'magenta');
  log('='.repeat(60), 'blue');
}

// Store user objects
let adminUser = null;
let salesmanUser = null;
let createdTaskIds = [];
let createdCustomerIds = [];
let createdProductIds = [];
let createdOrderIds = [];

// ============================================
// HELPER FUNCTIONS
// ============================================

async function verifyUser(email, password) {
  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logError(`User not found: ${email}`);
      return null;
    }
    
    if (user.status !== 'Active') {
      logError(`User is not active: ${email} (Status: ${user.status})`);
      return null;
    }
    
    if (!user.password) {
      logError(`User password not set: ${email}`);
      return null;
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logError(`Password mismatch for user: ${email}`);
      return null;
    }
    
    return user;
  } catch (error) {
    logError(`Error verifying user ${email}: ${error.message}`);
    return null;
  }
}

// ============================================
// AUTHENTICATION TESTS
// ============================================

async function testAuthentication() {
  logSection('AUTHENTICATION');

  try {
    logInfo(`Verifying admin user: ${ADMIN_EMAIL}`);
    adminUser = await verifyUser(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (adminUser) {
      logSuccess(`Admin verified: ${adminUser.name} (${adminUser.email})`);
      logInfo(`Admin ID: ${adminUser._id}`);
      logInfo(`Admin Role: ${adminUser.role}`);
      logInfo(`Admin Status: ${adminUser.status}`);
    } else {
      logError('Admin authentication failed');
      logInfo('Please check:');
      logInfo('  1. User exists in database');
      logInfo('  2. User status is "Active"');
      logInfo('  3. Password is correct');
      logInfo('  4. Password is hashed in database');
      return false;
    }

    logInfo(`Verifying salesman user: ${SALESMAN_EMAIL}`);
    salesmanUser = await verifyUser(SALESMAN_EMAIL, SALESMAN_PASSWORD);
    if (salesmanUser) {
      logSuccess(`Salesman verified: ${salesmanUser.name} (${salesmanUser.email})`);
      logInfo(`Salesman ID: ${salesmanUser._id}`);
      logInfo(`Salesman Role: ${salesmanUser.role}`);
      logInfo(`Salesman Status: ${salesmanUser.status}`);
    } else {
      logError('Salesman authentication failed');
      logInfo('Please check:');
      logInfo('  1. User exists in database');
      logInfo('  2. User status is "Active"');
      logInfo('  3. Password is correct');
      logInfo('  4. Password is hashed in database');
      return false;
    }

    return true;
  } catch (error) {
    logError('Authentication test failed', error);
    return false;
  }
}

// ============================================
// ADMIN TASK TESTS
// ============================================

async function testAdminCreateTask() {
  logSection('ADMIN: Create Task');

  try {
    // Generate follow-up number
    const lastTask = await FollowUp.findOne().sort({ followUpNumber: -1 });
    const lastNumber = lastTask?.followUpNumber?.match(/\d+/) ? parseInt(lastTask.followUpNumber.match(/\d+/)[0]) : 0;
    const followUpNumber = `FU${String(lastNumber + 1).padStart(6, '0')}`;

    const scheduledDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const taskData = {
      followUpNumber,
      salesman: salesmanUser._id,
      customerName: 'Test Customer - Database Direct',
      customerEmail: 'testcustomer@example.com',
      scheduledDate,
      dueDate,
      type: 'Call',
      priority: 'High',
      status: 'Upcoming',
      description: 'This task was created by admin via database test',
      approvalStatus: 'Approved',
      createdBy: adminUser._id
    };

    const task = await FollowUp.create(taskData);
    createdTaskIds.push(task._id);

    logSuccess(`Task created: ${task.followUpNumber}`);
    logInfo(`Task ID: ${task._id}`);
    logInfo(`Approval Status: ${task.approvalStatus}`);
    logInfo(`Status: ${task.status}`);
    return true;
  } catch (error) {
    logError('Admin task creation failed', error);
    return false;
  }
}

async function testAdminGetAllTasks() {
  logSection('ADMIN: Get All Tasks');

  try {
    const tasks = await FollowUp.find()
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    logSuccess(`Found ${tasks.length} tasks`);
    if (tasks.length > 0) {
      logInfo(`Latest task: ${tasks[0].followUpNumber} - ${tasks[0].customerName}`);
    }
    return true;
  } catch (error) {
    logError('Get all tasks failed', error);
    return false;
  }
}

async function testAdminGetTasksWithFilters() {
  logSection('ADMIN: Get Tasks with Filters');

  const filters = [
    { status: 'Pending' },
    { status: 'Overdue' },
    { priority: 'High' },
    { type: 'Call' },
    { approvalStatus: 'Pending' },
    { approvalStatus: 'Approved' }
  ];

  let passed = 0;
  for (const filter of filters) {
    try {
      const tasks = await FollowUp.find(filter).limit(10);
      logInfo(`Filter ${JSON.stringify(filter)}: Found ${tasks.length} tasks`);
      passed++;
    } catch (error) {
      logError(`Filter ${JSON.stringify(filter)} failed`, error);
    }
  }

  if (passed === filters.length) {
    logSuccess(`All ${filters.length} filters tested successfully`);
    return true;
  } else {
    logError(`${filters.length - passed} filters failed`);
    return false;
  }
}

async function testAdminUpdateTask() {
  logSection('ADMIN: Update Task');

  try {
    const task = await FollowUp.findOne({ createdBy: adminUser._id });
    if (!task) {
      logWarning('No task found to update');
      return false;
    }

    task.title = 'Updated Task Title - Database Test';
    task.description = 'This task was updated via database test';
    task.priority = 'Medium';
    await task.save();

    logSuccess(`Task updated: ${task._id}`);
    logInfo(`New title: ${task.title}`);
    return true;
  } catch (error) {
    logError('Update task failed', error);
    return false;
  }
}

async function testAdminTaskStatistics() {
  logSection('ADMIN: Task Statistics');

  try {
    const stats = {
      total: await FollowUp.countDocuments(),
      pending: await FollowUp.countDocuments({ status: 'Pending' }),
      overdue: await FollowUp.countDocuments({ status: 'Overdue' }),
      completed: await FollowUp.countDocuments({ status: 'Completed' }),
      pendingApproval: await FollowUp.countDocuments({ approvalStatus: 'Pending' }),
      approved: await FollowUp.countDocuments({ approvalStatus: 'Approved' })
    };

    logSuccess('Statistics calculated');
    logInfo(`Total: ${stats.total}`);
    logInfo(`Pending: ${stats.pending}`);
    logInfo(`Overdue: ${stats.overdue}`);
    logInfo(`Completed: ${stats.completed}`);
    logInfo(`Pending Approval: ${stats.pendingApproval}`);
    logInfo(`Approved: ${stats.approved}`);
    return true;
  } catch (error) {
    logError('Statistics calculation failed', error);
    return false;
  }
}

// ============================================
// SALESMAN TASK TESTS
// ============================================

async function testSalesmanCreateTask() {
  logSection('SALESMAN: Create Task');

  try {
    // Generate follow-up number
    const lastTask = await FollowUp.findOne().sort({ followUpNumber: -1 });
    const lastNumber = lastTask?.followUpNumber?.match(/\d+/) ? parseInt(lastTask.followUpNumber.match(/\d+/)[0]) : 0;
    const followUpNumber = `FU${String(lastNumber + 1).padStart(6, '0')}`;

    const scheduledDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

    const taskData = {
      followUpNumber,
      salesman: salesmanUser._id,
      customerName: 'Test Customer - Salesman Task',
      customerEmail: 'testcustomer2@example.com',
      scheduledDate,
      dueDate,
      type: 'Visit',
      priority: 'Medium',
      status: 'Upcoming',
      description: 'This task was created by salesman via database test',
      approvalStatus: 'Pending', // Salesman tasks need approval
      createdBy: salesmanUser._id
    };

    const task = await FollowUp.create(taskData);
    createdTaskIds.push(task._id);

    logSuccess(`Task created: ${task.followUpNumber}`);
    logInfo(`Task ID: ${task._id}`);
    logInfo(`Approval Status: ${task.approvalStatus} (should be Pending)`);
    return true;
  } catch (error) {
    logError('Salesman task creation failed', error);
    return false;
  }
}

async function testSalesmanGetMyTasks() {
  logSection('SALESMAN: Get My Tasks');

  try {
    const tasks = await FollowUp.find({ salesman: salesmanUser._id })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    logSuccess(`Found ${tasks.length} tasks assigned to salesman`);
    if (tasks.length > 0) {
      logInfo(`Latest task: ${tasks[0].followUpNumber} - ${tasks[0].customerName}`);
    }
    return true;
  } catch (error) {
    logError('Get my tasks failed', error);
    return false;
  }
}

async function testSalesmanUpdateTask() {
  logSection('SALESMAN: Update Task');

  try {
    const task = await FollowUp.findOne({ 
      createdBy: salesmanUser._id,
      approvalStatus: 'Pending'
    });
    
    if (!task) {
      logWarning('No pending salesman task found to update');
      return false;
    }

    task.description = 'Updated by salesman via database test';
    task.priority = 'High';
    await task.save();

    logSuccess(`Task updated: ${task._id}`);
    return true;
  } catch (error) {
    logError('Salesman update task failed', error);
    return false;
  }
}

// ============================================
// TASK APPROVAL TESTS
// ============================================

async function testApproveTask() {
  logSection('ADMIN: Approve Task');

  try {
    const task = await FollowUp.findOne({ 
      approvalStatus: 'Pending',
      createdBy: salesmanUser._id
    });

    if (!task) {
      logWarning('No pending task found to approve');
      return false;
    }

    task.approvalStatus = 'Approved';
    task.status = 'Upcoming';
    await task.save();

    logSuccess(`Task approved: ${task._id}`);
    logInfo(`New approval status: ${task.approvalStatus}`);
    return true;
  } catch (error) {
    logError('Approve task failed', error);
    return false;
  }
}

async function testRejectTask() {
  logSection('ADMIN: Reject Task');

  try {
    // Generate follow-up number
    const lastTask = await FollowUp.findOne().sort({ followUpNumber: -1 });
    const lastNumber = lastTask?.followUpNumber?.match(/\d+/) ? parseInt(lastTask.followUpNumber.match(/\d+/)[0]) : 0;
    const followUpNumber = `FU${String(lastNumber + 1).padStart(6, '0')}`;

    const scheduledDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // Create a task to reject
    const taskData = {
      followUpNumber,
      salesman: salesmanUser._id,
      customerName: 'Task to Reject Customer',
      customerEmail: 'reject@example.com',
      scheduledDate,
      dueDate,
      type: 'Email',
      priority: 'Low',
      status: 'Upcoming',
      description: 'This task will be rejected',
      approvalStatus: 'Pending',
      createdBy: salesmanUser._id
    };

    const task = await FollowUp.create(taskData);
    createdTaskIds.push(task._id);

    task.approvalStatus = 'Rejected';
    task.status = 'Completed'; // Use valid status enum value
    task.notes = 'Task rejected by admin';
    await task.save();

    logSuccess(`Task rejected: ${task.followUpNumber}`);
    logInfo(`New approval status: ${task.approvalStatus}`);
    logInfo(`New status: ${task.status}`);
    return true;
  } catch (error) {
    logError('Reject task failed', error);
    return false;
  }
}

// ============================================
// CUSTOMER TESTS
// ============================================

async function testCreateCustomer() {
  logSection('CUSTOMER: Create Customer');

  try {
    const customerData = {
      firstName: 'Test',
      lastName: 'Customer',
      email: `testcustomer${Date.now()}@example.com`,
      phone: '+1234567890',
      address: '123 Test Street, Test City',
      assignedSalesman: salesmanUser._id,
      status: 'Active',
      createdBy: adminUser._id
    };

    const customer = await Customer.create(customerData);
    createdCustomerIds.push(customer._id);

    logSuccess(`Customer created: ${customer.firstName} ${customer.lastName}`);
    logInfo(`Customer ID: ${customer._id}`);
    logInfo(`Email: ${customer.email}`);
    return true;
  } catch (error) {
    logError('Create customer failed', error);
    return false;
  }
}

async function testGetCustomers() {
  logSection('CUSTOMER: Get Customers');

  try {
    const customers = await Customer.find()
      .populate('assignedSalesman', 'name email')
      .sort({ createdAt: -1 });

    logSuccess(`Found ${customers.length} customers`);
    if (customers.length > 0) {
      logInfo(`Latest customer: ${customers[0].firstName} ${customers[0].lastName}`);
    }
    return true;
  } catch (error) {
    logError('Get customers failed', error);
    return false;
  }
}

// ============================================
// PRODUCT TESTS
// ============================================

async function testGetProducts() {
  logSection('PRODUCT: Get Products');

  try {
    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 });

    logSuccess(`Found ${products.length} active products`);
    if (products.length > 0) {
      logInfo(`Latest product: ${products[0].name}`);
      logInfo(`Product Code: ${products[0].productCode}`);
      logInfo(`Price: £${products[0].price}`);
    }
    return true;
  } catch (error) {
    logError('Get products failed', error);
    return false;
  }
}

// ============================================
// SALES ORDER TESTS
// ============================================

async function testGetSalesOrders() {
  logSection('SALES ORDER: Get Sales Orders');

  try {
    const orders = await SalesOrder.find()
      .populate('salesPerson', 'name email')
      .populate('customer', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(10);

    logSuccess(`Found ${orders.length} sales orders`);
    if (orders.length > 0) {
      logInfo(`Latest order: ${orders[0].soNumber || orders[0]._id}`);
      logInfo(`Status: ${orders[0].orderStatus}`);
      logInfo(`Grand Total: £${orders[0].grandTotal || 0}`);
    }
    return true;
  } catch (error) {
    logError('Get sales orders failed', error);
    return false;
  }
}

// ============================================
// SALES TARGET TESTS
// ============================================

async function testGetSalesTargets() {
  logSection('SALES TARGET: Get Sales Targets');

  try {
    const targets = await SalesTarget.find({ salesman: salesmanUser._id })
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    logSuccess(`Found ${targets.length} sales targets for salesman`);
    if (targets.length > 0) {
      logInfo(`Latest target: ${targets[0].targetType}`);
      logInfo(`Target Value: £${targets[0].targetValue || 0}`);
      logInfo(`Current Progress: £${targets[0].currentProgress || 0}`);
      logInfo(`Status: ${targets[0].status}`);
    }
    return true;
  } catch (error) {
    logError('Get sales targets failed', error);
    return false;
  }
}

// ============================================
// HUBSPOT TESTS (if configured)
// ============================================

async function testHubSpotConnection() {
  logSection('HUBSPOT: Connection Test');

  try {
    const hubspotToken = config.HUBSPOT_TOKEN || config.HUBSPOT_ACCESS_TOKEN || config.HUBSPOT_API_KEY;
    if (!hubspotToken) {
      logWarning('HubSpot token not configured - skipping HubSpot tests');
      return false;
    }

    logInfo('HubSpot token found');
    logInfo(`Auth Mode: ${config.HUBSPOT_AUTH_MODE || 'token'}`);
    
    // Test HubSpot connection by checking if service is available
    if (hubspotService && typeof hubspotService === 'object') {
      logSuccess('HubSpot service is available');
      logInfo('HubSpot integration is configured');
      return true;
    } else {
      logError('HubSpot service not available');
      return false;
    }
  } catch (error) {
    logError('HubSpot connection test failed', error);
    return false;
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('🚀 COMPREHENSIVE DATABASE-DIRECT TEST SUITE', 'magenta');
  log('📦 Direct Database Access (No HTTP API)', 'cyan');
  log('='.repeat(60) + '\n', 'blue');

  try {
    // Connect to database
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // Check HubSpot configuration
    log('-'.repeat(60), 'cyan');
    log('🔗 HubSpot Configuration Check', 'cyan');
    log('-'.repeat(60), 'cyan');
    const hubspotToken = config.HUBSPOT_TOKEN || config.HUBSPOT_ACCESS_TOKEN || config.HUBSPOT_API_KEY;
    if (hubspotToken) {
      logSuccess('HubSpot token found - Tasks will be synced to HubSpot');
      logInfo(`Auth Mode: ${config.HUBSPOT_AUTH_MODE || 'token'}`);
    } else {
      logWarning('⚠️  HubSpot token not configured - Tasks will NOT sync to HubSpot');
      logInfo('To enable HubSpot sync, add HUBSPOT_TOKEN to .env file');
    }
    log('');

    // Authentication
    const authSuccess = await testAuthentication();
    if (!authSuccess) {
      logError('Authentication failed - Cannot continue tests');
      printSummary();
      process.exit(1);
    }

    // Admin Task Tests
    await testAdminCreateTask();
    await testAdminGetAllTasks();
    await testAdminGetTasksWithFilters();
    await testAdminUpdateTask();
    await testAdminTaskStatistics();

    // Salesman Task Tests
    await testSalesmanCreateTask();
    await testSalesmanGetMyTasks();
    await testSalesmanUpdateTask();

    // Task Approval Tests
    await testApproveTask();
    await testRejectTask();

    // Customer Tests
    await testCreateCustomer();
    await testGetCustomers();

    // Product Tests
    await testGetProducts();

    // Sales Order Tests
    await testGetSalesOrders();

    // Sales Target Tests
    await testGetSalesTargets();

    // HubSpot Tests
    await testHubSpotConnection();

    // Print Summary
    printSummary();

    // Cleanup (optional - comment out if you want to keep test data)
    logSection('CLEANUP');
    logInfo('Test data cleanup skipped (data preserved for inspection)');
    logInfo(`Created ${createdTaskIds.length} tasks`);
    logInfo(`Created ${createdCustomerIds.length} customers`);

  } catch (error) {
    logError('Fatal error running tests', error);
    printSummary();
    await mongoose.connection.close();
    process.exit(1);
  } finally {
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logInfo('Database connection closed');
    }
  }
}

function printSummary() {
  log('\n' + '='.repeat(60), 'blue');
  log('📊 TEST SUMMARY', 'magenta');
  log('='.repeat(60), 'blue');
  
  const passRate = testResults.total > 0 
    ? ((testResults.passed / testResults.total) * 100).toFixed(2)
    : 0;
  
  log(`\nTotal Tests: ${testResults.total}`, 'cyan');
  log(`✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, 'red');
  log(`📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');
  
  if (testResults.errors.length > 0) {
    log('\n⚠️  ERRORS:', 'yellow');
    testResults.errors.forEach((err, index) => {
      log(`${index + 1}. ${err.message}`, 'red');
      if (err.error) {
        log(`   Error: ${err.error}`, 'red');
      }
    });
  }
  
  log('\n' + '='.repeat(60) + '\n', 'blue');
}

// Run tests
runAllTests().catch(error => {
  logError('Fatal error running tests', error);
  printSummary();
  process.exit(1);
});
