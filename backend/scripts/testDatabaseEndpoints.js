/**
 * Comprehensive Database Test Script
 * Tests ALL Admin and Salesman database models and operations directly
 * WITHOUT using HTTP API - Direct database testing
 * 
 * Usage:
 *   node backend/scripts/testDatabaseEndpoints.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const config = require('../config');

// Import all models
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');
const FollowUp = require('../database/models/FollowUp');
const SalesTarget = require('../database/models/SalesTarget');
const SalesOrder = require('../database/models/SalesOrder');
const SalesSubmission = require('../database/models/SalesSubmission');
const Quotation = require('../database/models/Quotation');
const Sample = require('../database/models/Sample');
const VisitTarget = require('../database/models/VisitTarget');
const Tracking = require('../database/models/Tracking');
const Location = require('../database/models/Location');
const ShiftPhoto = require('../database/models/ShiftPhoto');
const ProductVideo = require('../database/models/ProductVideo');
const Milestone = require('../database/models/Milestone');

// Test Results
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
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
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
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
    console.log(`   ${colors.red}Error: ${error.message || error}${colors.reset}`);
  }
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
  testResults.skipped++;
  testResults.total++;
}

function logSection(message) {
  log(`\n${'='.repeat(70)}`, 'blue');
  log(`${colors.bold}${message}${colors.reset}`, 'magenta');
  log('='.repeat(70), 'blue');
}

// Store created IDs for relationship testing
const createdIds = {
  admin: null,
  salesman: null,
  customer: null,
  product: null,
  followUp: null,
  salesTarget: null,
  salesOrder: null,
  quotation: null,
  sample: null,
  visitTarget: null,
  tracking: null,
  location: null
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function testModelOperation(name, operation) {
  process.stdout.write(`  Testing ${name}... `);
  try {
    const result = await operation();
    console.log(`${colors.green}✓ PASSED${colors.reset}`);
    testResults.passed++;
    testResults.total++;
    return { success: true, data: result };
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset}`);
    testResults.failed++;
    testResults.total++;
    testResults.errors.push({ message: name, error: error.message || error });
    console.log(`     ${colors.red}Error: ${error.message}${colors.reset}`);
    return { success: false, error };
  }
}

// ============================================
// USER MODEL TESTS
// ============================================

async function testUserModel() {
  logSection('USER MODEL TESTS');
  
  // Create Admin User
  await testModelOperation('Create Admin User', async () => {
    const admin = await User.create({
      name: 'Test Admin DB',
      email: `testadmin${Date.now()}@test.com`,
      password: 'Test123!@#',
      role: 'admin',
      status: 'Active'
    });
    createdIds.admin = admin._id;
    return admin;
  });
  
  // Create Salesman User
  await testModelOperation('Create Salesman User', async () => {
    const salesman = await User.create({
      name: 'Test Salesman DB',
      email: `testsalesman${Date.now()}@test.com`,
      password: 'Test123!@#',
      role: 'salesman',
      status: 'Active'
    });
    createdIds.salesman = salesman._id;
    return salesman;
  });
  
  // Read Operations
  await testModelOperation('Find All Users', async () => {
    return await User.find({});
  });
  
  await testModelOperation('Find Admin Users', async () => {
    return await User.find({ role: 'admin' });
  });
  
  await testModelOperation('Find Salesman Users', async () => {
    return await User.find({ role: 'salesman' });
  });
  
  await testModelOperation('Find User by ID', async () => {
    if (!createdIds.admin) throw new Error('No admin ID available');
    return await User.findById(createdIds.admin);
  });
  
  await testModelOperation('Find User by Email', async () => {
    if (!createdIds.admin) throw new Error('No admin ID available');
    const admin = await User.findById(createdIds.admin);
    return await User.findOne({ email: admin.email });
  });
  
  // Update Operations
  await testModelOperation('Update User', async () => {
    if (!createdIds.admin) throw new Error('No admin ID available');
    return await User.findByIdAndUpdate(
      createdIds.admin,
      { name: 'Updated Test Admin' },
      { new: true }
    );
  });
  
  // Password Operations
  await testModelOperation('Compare Password', async () => {
    if (!createdIds.admin) throw new Error('No admin ID available');
    const admin = await User.findById(createdIds.admin).select('+password');
    return await admin.comparePassword('Test123!@#');
  });
  
  // Validation Tests
  await testModelOperation('Validate Email Format', async () => {
    try {
      await User.create({
        name: 'Test',
        email: 'invalid-email',
        password: 'Test123',
        role: 'admin'
      });
      throw new Error('Should have failed validation');
    } catch (error) {
      if (error.message.includes('valid email')) {
        return { validated: true };
      }
      throw error;
    }
  });
  
  await testModelOperation('Validate Required Fields', async () => {
    try {
      await User.create({
        name: 'Test'
        // Missing email, password, role
      });
      throw new Error('Should have failed validation');
    } catch (error) {
      if (error.message.includes('required')) {
        return { validated: true };
      }
      throw error;
    }
  });
}

// ============================================
// CUSTOMER MODEL TESTS
// ============================================

async function testCustomerModel() {
  logSection('CUSTOMER MODEL TESTS');
  
  if (!createdIds.admin) {
    logWarning('Skipping customer tests - no admin user available');
    return;
  }
  
  // Create Customer
  await testModelOperation('Create Customer', async () => {
    const customer = await Customer.create({
      firstName: 'Test',
      name: 'Test Customer DB',
      email: `testcustomer${Date.now()}@test.com`,
      phone: '1234567890',
      address: '123 Test Street',
      city: 'Test City',
      status: 'Active',
      createdBy: createdIds.admin
    });
    createdIds.customer = customer._id;
    return customer;
  });
  
  // Read Operations
  await testModelOperation('Find All Customers', async () => {
    return await Customer.find({});
  });
  
  await testModelOperation('Find Customer by ID', async () => {
    if (!createdIds.customer) throw new Error('No customer ID available');
    return await Customer.findById(createdIds.customer);
  });
  
  await testModelOperation('Find Customer with Creator', async () => {
    if (!createdIds.customer) throw new Error('No customer ID available');
    return await Customer.findById(createdIds.customer).populate('createdBy');
  });
  
  await testModelOperation('Find Customers by Status', async () => {
    return await Customer.find({ status: 'Active' });
  });
  
  await testModelOperation('Find Customers by Creator', async () => {
    if (!createdIds.admin) throw new Error('No admin ID available');
    return await Customer.find({ createdBy: createdIds.admin });
  });
  
  // Update Operations
  await testModelOperation('Update Customer', async () => {
    if (!createdIds.customer) throw new Error('No customer ID available');
    return await Customer.findByIdAndUpdate(
      createdIds.customer,
      { name: 'Updated Test Customer', status: 'Visited' },
      { new: true }
    );
  });
  
  // Search Operations
  await testModelOperation('Search Customers by Name', async () => {
    return await Customer.find({
      $or: [
        { name: { $regex: 'Test', $options: 'i' } },
        { firstName: { $regex: 'Test', $options: 'i' } }
      ]
    });
  });
  
  await testModelOperation('Search Customers by Email', async () => {
    return await Customer.find({
      email: { $regex: 'test', $options: 'i' }
    });
  });
  
  // Count Operations
  await testModelOperation('Count All Customers', async () => {
    return await Customer.countDocuments({});
  });
  
  await testModelOperation('Count Customers by Status', async () => {
    return await Customer.countDocuments({ status: 'Active' });
  });
}

// ============================================
// PRODUCT MODEL TESTS
// ============================================

async function testProductModel() {
  logSection('PRODUCT MODEL TESTS');
  
  // Create Product
  await testModelOperation('Create Product', async () => {
    const product = await Product.create({
      productCode: `PROD${Date.now()}`,
      name: 'Test Product DB',
      description: 'Test Product Description',
      price: 99.99,
      category: 'Test Category',
      stock: 100
    });
    createdIds.product = product._id;
    return product;
  });
  
  // Read Operations
  await testModelOperation('Find All Products', async () => {
    return await Product.find({});
  });
  
  await testModelOperation('Find Product by ID', async () => {
    if (!createdIds.product) throw new Error('No product ID available');
    return await Product.findById(createdIds.product);
  });
  
  await testModelOperation('Find Product by Code', async () => {
    if (!createdIds.product) throw new Error('No product ID available');
    const product = await Product.findById(createdIds.product);
    return await Product.findOne({ productCode: product.productCode });
  });
  
  await testModelOperation('Find Active Products', async () => {
    return await Product.find({ isActive: true });
  });
  
  await testModelOperation('Find Products by Category', async () => {
    return await Product.find({ category: 'Test Category' });
  });
  
  // Update Operations
  await testModelOperation('Update Product', async () => {
    if (!createdIds.product) throw new Error('No product ID available');
    return await Product.findByIdAndUpdate(
      createdIds.product,
      { name: 'Updated Test Product', price: 149.99 },
      { new: true }
    );
  });
  
  await testModelOperation('Update Product Stock', async () => {
    if (!createdIds.product) throw new Error('No product ID available');
    return await Product.findByIdAndUpdate(
      createdIds.product,
      { $inc: { stock: -10 } },
      { new: true }
    );
  });
  
  // Validation Tests
  await testModelOperation('Validate Unique Product Code', async () => {
    if (!createdIds.product) throw new Error('No product ID available');
    const product = await Product.findById(createdIds.product);
    try {
      await Product.create({
        productCode: product.productCode, // Duplicate
        name: 'Duplicate Product',
        price: 50,
        category: 'Test'
      });
      throw new Error('Should have failed unique constraint');
    } catch (error) {
      if (error.code === 11000 || error.message.includes('duplicate')) {
        return { validated: true };
      }
      throw error;
    }
  });
}

// ============================================
// FOLLOW-UP MODEL TESTS
// ============================================

async function testFollowUpModel() {
  logSection('FOLLOW-UP (TASKS) MODEL TESTS');
  
  if (!createdIds.salesman || !createdIds.customer) {
    logWarning('Skipping follow-up tests - missing salesman or customer');
    return;
  }
  
  // Create Follow-Up
  await testModelOperation('Create Follow-Up', async () => {
    const followUp = await FollowUp.create({
      salesman: createdIds.salesman,
      customer: createdIds.customer,
      customerName: 'Test Customer Follow-up',
      customerEmail: 'test@example.com',
      customerPhone: '1234567890',
      type: 'Call',
      priority: 'High',
      dueDate: new Date(Date.now() + 86400000),
      scheduledDate: new Date(),
      description: 'Test Follow-up Description',
      createdBy: createdIds.admin
    });
    createdIds.followUp = followUp._id;
    return followUp;
  });
  
  // Read Operations
  await testModelOperation('Find All Follow-Ups', async () => {
    return await FollowUp.find({});
  });
  
  await testModelOperation('Find Follow-Up by ID', async () => {
    if (!createdIds.followUp) throw new Error('No follow-up ID available');
    return await FollowUp.findById(createdIds.followUp);
  });
  
  await testModelOperation('Find Follow-Ups by Salesman', async () => {
    if (!createdIds.salesman) throw new Error('No salesman ID available');
    return await FollowUp.find({ salesman: createdIds.salesman });
  });
  
  await testModelOperation('Find Follow-Ups by Status', async () => {
    return await FollowUp.find({ status: 'Upcoming' });
  });
  
  await testModelOperation('Find Follow-Ups by Type', async () => {
    return await FollowUp.find({ type: 'Call' });
  });
  
  await testModelOperation('Find Follow-Ups by Priority', async () => {
    return await FollowUp.find({ priority: 'High' });
  });
  
  await testModelOperation('Find Follow-Ups with Populated Relations', async () => {
    if (!createdIds.followUp) throw new Error('No follow-up ID available');
    return await FollowUp.findById(createdIds.followUp)
      .populate('salesman')
      .populate('customer')
      .populate('createdBy');
  });
  
  // Update Operations
  await testModelOperation('Update Follow-Up', async () => {
    if (!createdIds.followUp) throw new Error('No follow-up ID available');
    return await FollowUp.findByIdAndUpdate(
      createdIds.followUp,
      { description: 'Updated Follow-up Description', priority: 'Urgent' },
      { new: true }
    );
  });
  
  await testModelOperation('Mark Follow-Up as Completed', async () => {
    if (!createdIds.followUp) throw new Error('No follow-up ID available');
    return await FollowUp.findByIdAndUpdate(
      createdIds.followUp,
      { 
        status: 'Completed',
        completedDate: new Date()
      },
      { new: true }
    );
  });
  
  // Query Operations
  await testModelOperation('Find Overdue Follow-Ups', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return await FollowUp.find({
      dueDate: { $lt: new Date() },
      status: { $ne: 'Completed' }
    });
  });
  
  await testModelOperation('Find Today Follow-Ups', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return await FollowUp.find({
      dueDate: { $gte: today, $lt: tomorrow }
    });
  });
  
  // Count Operations
  await testModelOperation('Count Follow-Ups by Status', async () => {
    return await FollowUp.countDocuments({ status: 'Upcoming' });
  });
}

// ============================================
// SALES TARGET MODEL TESTS
// ============================================

async function testSalesTargetModel() {
  logSection('SALES TARGET MODEL TESTS');
  
  if (!createdIds.salesman) {
    logWarning('Skipping sales target tests - no salesman available');
    return;
  }
  
  // Create Sales Target
  await testModelOperation('Create Sales Target', async () => {
    const target = await SalesTarget.create({
      salesman: createdIds.salesman,
      targetAmount: 10000,
      period: 'monthly',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    createdIds.salesTarget = target._id;
    return target;
  });
  
  // Read Operations
  await testModelOperation('Find All Sales Targets', async () => {
    return await SalesTarget.find({});
  });
  
  await testModelOperation('Find Sales Target by ID', async () => {
    if (!createdIds.salesTarget) throw new Error('No sales target ID available');
    return await SalesTarget.findById(createdIds.salesTarget);
  });
  
  await testModelOperation('Find Sales Targets by Salesman', async () => {
    if (!createdIds.salesman) throw new Error('No salesman ID available');
    return await SalesTarget.find({ salesman: createdIds.salesman });
  });
  
  await testModelOperation('Find Active Sales Targets', async () => {
    const now = new Date();
    return await SalesTarget.find({
      startDate: { $lte: now },
      endDate: { $gte: now }
    });
  });
  
  // Update Operations
  await testModelOperation('Update Sales Target', async () => {
    if (!createdIds.salesTarget) throw new Error('No sales target ID available');
    return await SalesTarget.findByIdAndUpdate(
      createdIds.salesTarget,
      { targetAmount: 15000 },
      { new: true }
    );
  });
}

// ============================================
// ADDITIONAL MODEL TESTS
// ============================================

async function testAdditionalModels() {
  logSection('ADDITIONAL MODEL TESTS');
  
  // Quotation Tests
  if (createdIds.customer && createdIds.salesman) {
    await testModelOperation('Create Quotation', async () => {
      const quotation = await Quotation.create({
        customerName: 'Test Customer',
        items: [{ product: 'Test Product', quantity: 2, price: 100 }],
        salesman: createdIds.salesman
      });
      createdIds.quotation = quotation._id;
      return quotation;
    });
    
    await testModelOperation('Find Quotations by Salesman', async () => {
      if (!createdIds.salesman) throw new Error('No salesman ID available');
      return await Quotation.find({ salesman: createdIds.salesman });
    });
  }
  
  // Sample Tests
  if (createdIds.customer && createdIds.salesman) {
    await testModelOperation('Create Sample', async () => {
      const sample = await Sample.create({
        customerName: 'Test Customer',
        productName: 'Test Product',
        status: 'Pending',
        salesman: createdIds.salesman
      });
      createdIds.sample = sample._id;
      return sample;
    });
  }
  
  // Visit Target Tests
  if (createdIds.customer && createdIds.salesman) {
    await testModelOperation('Create Visit Target', async () => {
      const visitTarget = await VisitTarget.create({
        customerName: 'Test Customer',
        visitDate: new Date(Date.now() + 86400000),
        status: 'Pending',
        salesman: createdIds.salesman
      });
      createdIds.visitTarget = visitTarget._id;
      return visitTarget;
    });
  }
  
  // Tracking Tests
  if (createdIds.salesman) {
    await testModelOperation('Create Tracking', async () => {
      const tracking = await Tracking.create({
        salesman: createdIds.salesman,
        latitude: 24.8607,
        longitude: 67.0011,
        address: 'Test Location',
        isActive: true
      });
      createdIds.tracking = tracking._id;
      return tracking;
    });
    
    await testModelOperation('Find Active Tracking', async () => {
      if (!createdIds.salesman) throw new Error('No salesman ID available');
      return await Tracking.find({ 
        salesman: createdIds.salesman,
        isActive: true 
      });
    });
  }
  
  // Location Tests
  if (createdIds.salesman) {
    await testModelOperation('Create Location', async () => {
      const location = await Location.create({
        salesman: createdIds.salesman,
        latitude: 24.8607,
        longitude: 67.0011,
        address: 'Test Location Address'
      });
      createdIds.location = location._id;
      return location;
    });
    
    await testModelOperation('Find Latest Location by Salesman', async () => {
      if (!createdIds.salesman) throw new Error('No salesman ID available');
      return await Location.findOne({ salesman: createdIds.salesman })
        .sort({ createdAt: -1 });
    });
  }
}

// ============================================
// AGGREGATION TESTS
// ============================================

async function testAggregations() {
  logSection('AGGREGATION & STATISTICS TESTS');
  
  // Customer Statistics
  await testModelOperation('Count Customers by Status', async () => {
    return await Customer.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
  });
  
  // Follow-Up Statistics
  await testModelOperation('Count Follow-Ups by Status', async () => {
    return await FollowUp.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
  });
  
  await testModelOperation('Count Follow-Ups by Type', async () => {
    return await FollowUp.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
  });
  
  await testModelOperation('Count Follow-Ups by Priority', async () => {
    return await FollowUp.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
  });
  
  // Product Statistics
  await testModelOperation('Calculate Total Product Value', async () => {
    return await Product.aggregate([
      {
        $project: {
          totalValue: { $multiply: ['$price', '$stock'] }
        }
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$totalValue' }
        }
      }
    ]);
  });
  
  // Sales Target Statistics
  if (createdIds.salesman) {
    await testModelOperation('Calculate Sales Target Progress', async () => {
      return await SalesTarget.aggregate([
        { $match: { salesman: createdIds.salesman } },
        {
          $project: {
            targetAmount: 1,
            achievedAmount: { $ifNull: ['$achievedAmount', 0] },
            progress: {
              $multiply: [
                { $divide: [{ $ifNull: ['$achievedAmount', 0] }, '$targetAmount'] },
                100
              ]
            }
          }
        }
      ]);
    });
  }
}

// ============================================
// CLEANUP FUNCTION
// ============================================

async function cleanupTestData() {
  logSection('CLEANING UP TEST DATA');
  
  try {
    // Delete in reverse order of dependencies
    if (createdIds.followUp) {
      await FollowUp.findByIdAndDelete(createdIds.followUp);
      logInfo('Deleted test follow-up');
    }
    if (createdIds.quotation) {
      await Quotation.findByIdAndDelete(createdIds.quotation);
      logInfo('Deleted test quotation');
    }
    if (createdIds.sample) {
      await Sample.findByIdAndDelete(createdIds.sample);
      logInfo('Deleted test sample');
    }
    if (createdIds.visitTarget) {
      await VisitTarget.findByIdAndDelete(createdIds.visitTarget);
      logInfo('Deleted test visit target');
    }
    if (createdIds.tracking) {
      await Tracking.findByIdAndDelete(createdIds.tracking);
      logInfo('Deleted test tracking');
    }
    if (createdIds.location) {
      await Location.findByIdAndDelete(createdIds.location);
      logInfo('Deleted test location');
    }
    if (createdIds.salesTarget) {
      await SalesTarget.findByIdAndDelete(createdIds.salesTarget);
      logInfo('Deleted test sales target');
    }
    if (createdIds.customer) {
      await Customer.findByIdAndDelete(createdIds.customer);
      logInfo('Deleted test customer');
    }
    if (createdIds.product) {
      await Product.findByIdAndDelete(createdIds.product);
      logInfo('Deleted test product');
    }
    if (createdIds.salesman) {
      await User.findByIdAndDelete(createdIds.salesman);
      logInfo('Deleted test salesman');
    }
    if (createdIds.admin) {
      await User.findByIdAndDelete(createdIds.admin);
      logInfo('Deleted test admin');
    }
    logSuccess('Test data cleanup completed');
  } catch (error) {
    logError('Error during cleanup', error);
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(70), 'blue');
  log(`${colors.bold}🗄️  COMPREHENSIVE DATABASE TEST SUITE${colors.reset}`, 'magenta');
  log('='.repeat(70) + '\n', 'blue');
  
  logInfo('Testing database models directly (no HTTP API)');
  logInfo(`MongoDB URI: ${config.MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}\n`);
  
  // Connect to database
  try {
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected successfully\n');
  } catch (error) {
    logError('Database connection failed', error);
    process.exit(1);
  }
  
  // Run tests
  await testUserModel();
  await testCustomerModel();
  await testProductModel();
  await testFollowUpModel();
  await testSalesTargetModel();
  await testAdditionalModels();
  await testAggregations();
  
  // Cleanup (optional - comment out if you want to keep test data)
  const KEEP_TEST_DATA = process.env.KEEP_TEST_DATA === 'true';
  if (!KEEP_TEST_DATA) {
    await cleanupTestData();
  } else {
    logInfo('Keeping test data (KEEP_TEST_DATA=true)');
  }
  
  // Print Summary
  printSummary();
  
  // Close database connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    logInfo('Database connection closed');
  }
}

function printSummary() {
  log('\n' + '='.repeat(70), 'blue');
  log(`${colors.bold}📊 TEST SUMMARY${colors.reset}`, 'magenta');
  log('='.repeat(70), 'blue');
  
  const passRate = testResults.total > 0 
    ? ((testResults.passed / testResults.total) * 100).toFixed(2)
    : 0;
  
  log(`\n${colors.bold}Total Tests: ${testResults.total}${colors.reset}`, 'cyan');
  log(`${colors.green}✅ Passed: ${testResults.passed}${colors.reset}`, 'green');
  log(`${colors.red}❌ Failed: ${testResults.failed}${colors.reset}`, 'red');
  log(`${colors.yellow}⚠️  Skipped: ${testResults.skipped}${colors.reset}`, 'yellow');
  log(`📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : passRate >= 50 ? 'yellow' : 'red');
  
  if (testResults.errors.length > 0) {
    log(`\n${colors.bold}⚠️  FAILED TESTS:${colors.reset}`, 'yellow');
    testResults.errors.forEach((err, index) => {
      log(`\n${index + 1}. ${err.message}`, 'red');
      if (err.error) {
        log(`   Error: ${err.error}`, 'red');
      }
    });
  }
  
  log('\n' + '='.repeat(70) + '\n', 'blue');
}

// Run tests
runAllTests().catch(error => {
  logError('Fatal error running tests', error);
  printSummary();
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close();
  }
  process.exit(1);
});
