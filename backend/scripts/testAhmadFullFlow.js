/**
 * Full Flow Test Script for Ahmad User
 * Tests: Tasks, Visit Requests, Visit Creation from Task, Follow-up, Sample Track
 * Usage: node backend/scripts/testAhmadFullFlow.js
 * 
 * This script tests:
 * 1. Create tasks for salesman (Ahmad)
 * 2. Create visit requests (before approval) - Karachi location
 * 3. Use customer "Jawwad"
 * 4. Create visit from task
 * 5. Admin creates follow-up and sample track
 * 6. Full flow check
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const VisitTarget = require('../database/models/VisitTarget');
const Sample = require('../database/models/Sample');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m'
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
    if (error.stack) {
      log(`   Stack: ${error.stack.split('\n')[1]}`, 'red');
    }
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

// Karachi location for visit requests
const karachiLocation = {
  name: 'Jawwad Malik - Karachi Office Visit',
  address: 'Block 9, Clifton, Karachi',
  city: 'Karachi',
  state: 'Sindh',
  pincode: '75600',
  latitude: 24.8138,
  longitude: 67.0720,
  priority: 'High',
  description: 'Visit to Jawwad Malik office in Clifton, Karachi'
};

async function main() {
  try {
    logStep('Full Flow Test Script - Ahmad User');
    logInfo('Connecting to database...');
    
    await connectDB();
    logSuccess('Database connected');

    // Step 1: Find or create Ahmad user (salesman)
    logStep('Step 1: Finding/Creating Ahmad User (Salesman)');
    let ahmadUser = await User.findOne({ 
      $or: [
        { email: /ahmad/i },
        { name: /ahmad/i },
        { firstName: /ahmad/i }
      ],
      role: 'salesman'
    });

    if (!ahmadUser) {
      logWarning('Ahmad user not found. Creating new salesman user...');
      ahmadUser = await User.create({
        name: 'Ahmad',
        firstName: 'Ahmad',
        email: 'ahmad@test.com',
        password: 'Test@123', // Will be hashed by pre-save hook
        role: 'salesman',
        status: 'Active',
        phone: '+923001234567'
      });
      logSuccess(`Created Ahmad user: ${ahmadUser.email}`);
    } else {
      logSuccess(`Found Ahmad user: ${ahmadUser.email || ahmadUser.name}`);
    }

    // Step 2: Find or create Admin user
    logStep('Step 2: Finding/Creating Admin User');
    let adminUser = await User.findOne({ role: 'admin' });

    if (!adminUser) {
      logWarning('Admin user not found. Creating new admin user...');
      adminUser = await User.create({
        name: 'Admin User',
        firstName: 'Admin',
        email: 'admin@test.com',
        password: 'Admin@123',
        role: 'admin',
        status: 'Active'
      });
      logSuccess(`Created Admin user: ${adminUser.email}`);
    } else {
      logSuccess(`Found Admin user: ${adminUser.email || adminUser.name}`);
    }

    // Step 3: Find or create customer "Jawwad"
    logStep('Step 3: Finding/Creating Customer "Jawwad"');
    let jawwadCustomer = await Customer.findOne({
      $or: [
        { firstName: /jawwad/i },
        { name: /jawwad/i },
        { email: /jawwad/i }
      ]
    });

    if (!jawwadCustomer) {
      logWarning('Jawwad customer not found. Creating new customer...');
      jawwadCustomer = await Customer.create({
        firstName: 'Jawwad',
        lastName: 'Malik',
        name: 'Jawwad Malik',
        email: 'jawwad@iotfiysolutions.com',
        phone: '+923352855321',
        address: 'Block 9, Clifton, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75600',
        status: 'Active',
        assignedTo: ahmadUser._id,
        createdBy: adminUser._id
      });
      logSuccess(`Created Jawwad customer: ${jawwadCustomer.name}`);
    } else {
      logSuccess(`Found Jawwad customer: ${jawwadCustomer.name || jawwadCustomer.firstName}`);
    }

    // Step 4: Create tasks for Ahmad (salesman-created, pending approval)
    logStep('Step 4: Creating Tasks for Ahmad (Pending Approval)');
    const today = new Date();
    today.setHours(9, 0, 0, 0); // 9 AM today
    
    const taskTypes = ['Follow-up', 'Sample Track'];
    const createdTasks = [];

    for (const taskType of taskTypes) {
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + (taskType === 'Follow-up' ? 1 : 2)); // Follow-up tomorrow, Sample Track day after

      const task = await FollowUp.create({
        salesman: ahmadUser._id,
        customer: jawwadCustomer._id,
        customerName: jawwadCustomer.name || jawwadCustomer.firstName,
        customerEmail: jawwadCustomer.email,
        customerPhone: jawwadCustomer.phone,
        type: taskType === 'Follow-up' ? 'Call' : 'Sample Feedback',
        priority: 'Medium',
        scheduledDate: dueDate,
        dueDate: dueDate,
        description: `${taskType} task for ${jawwadCustomer.name}`,
        notes: `Task created by salesman Ahmad for customer ${jawwadCustomer.name}`,
        createdBy: ahmadUser._id,
        approvalStatus: 'Pending', // Salesman-created tasks need approval
        source: 'app'
      });

      createdTasks.push(task);
      logSuccess(`Created ${taskType} task: ${task.followUpNumber} (Status: Pending Approval)`);
    }

    logSuccess(`Total tasks created: ${createdTasks.length}\n`);

    // Step 5: Create visit request (before approval) - Karachi location
    logStep('Step 5: Creating Visit Request (Pending Approval) - Karachi');
    const visitDate = new Date(today);
    visitDate.setDate(visitDate.getDate() + 1); // Tomorrow

    const visitRequest = await VisitTarget.create({
      name: karachiLocation.name,
      description: karachiLocation.description,
      salesman: ahmadUser._id,
      createdBy: ahmadUser._id, // Created by salesman
      latitude: karachiLocation.latitude,
      longitude: karachiLocation.longitude,
      address: karachiLocation.address,
      city: karachiLocation.city,
      state: karachiLocation.state,
      pincode: karachiLocation.pincode,
      visitDate: visitDate,
      priority: karachiLocation.priority,
      status: 'Pending',
      approvalStatus: 'Pending', // Visit request needs admin approval
      customerId: jawwadCustomer._id,
      customerName: jawwadCustomer.name || jawwadCustomer.firstName,
      notes: `Visit request created by salesman Ahmad for customer ${jawwadCustomer.name} in Karachi`
    });

    logSuccess(`Created visit request: ${visitRequest.name} (Status: Pending Approval)`);
    logInfo(`Location: ${karachiLocation.address}, ${karachiLocation.city}`);
    logInfo(`Coordinates: ${karachiLocation.latitude}, ${karachiLocation.longitude}\n`);

    // Step 6: Admin approves tasks and visit request
    logStep('Step 6: Admin Approving Tasks and Visit Request');
    
    // Approve tasks
    for (const task of createdTasks) {
      task.approvalStatus = 'Approved';
      task.approvedBy = adminUser._id;
      task.approvedAt = new Date();
      await task.save();
      logSuccess(`Approved task: ${task.followUpNumber}`);
    }

    // Approve visit request
    visitRequest.approvalStatus = 'Approved';
    visitRequest.approvedBy = adminUser._id;
    visitRequest.approvedAt = new Date();
    await visitRequest.save();
    logSuccess(`Approved visit request: ${visitRequest.name}\n`);

    // Step 7: Create visit from task (link task to visit)
    logStep('Step 7: Creating Visit from Task');
    const visitTask = createdTasks.find(t => t.type === 'Call'); // Use Follow-up task
    
    if (visitTask) {
      // Link task to visit (one-way: task -> visit)
      visitTask.visitTarget = visitRequest._id;
      await visitTask.save();
      
      logSuccess(`Linked task ${visitTask.followUpNumber} to visit ${visitRequest.name}`);
      logInfo(`Task ${visitTask.followUpNumber} now references visit ${visitRequest.name}`);
    }

    // Step 8: Admin creates follow-up task
    logStep('Step 8: Admin Creating Follow-up Task');
    const followUpDueDate = new Date(today);
    followUpDueDate.setDate(followUpDueDate.getDate() + 3); // 3 days from now

    const adminFollowUp = await FollowUp.create({
      salesman: ahmadUser._id,
      customer: jawwadCustomer._id,
      customerName: jawwadCustomer.name || jawwadCustomer.firstName,
      customerEmail: jawwadCustomer.email,
      customerPhone: jawwadCustomer.phone,
      type: 'Call',
      priority: 'High',
      scheduledDate: followUpDueDate,
      dueDate: followUpDueDate,
      description: `Admin-created follow-up for ${jawwadCustomer.name}`,
      notes: `Follow-up task created by admin for salesman Ahmad`,
      visitTarget: visitRequest._id,
      createdBy: adminUser._id,
      approvalStatus: 'Approved', // Admin-created tasks are auto-approved
      source: 'app'
    });

    logSuccess(`Created admin follow-up: ${adminFollowUp.followUpNumber} (Auto-approved)`);

    // Step 9: Admin creates sample track
    logStep('Step 9: Admin Creating Sample Track');
    
    // Find a product for sample
    let sampleProduct = await Product.findOne();
    if (!sampleProduct) {
      logWarning('No product found. Creating test product...');
      sampleProduct = await Product.create({
        productCode: 'PROD-TEST-001',
        productName: 'Test Product for Sample',
        category: 'Test',
        unitPrice: 100,
        status: 'Active'
      });
      logSuccess(`Created test product: ${sampleProduct.productName}`);
    }

    // Sample number will be auto-generated by pre-save hook
    const sampleTrack = await Sample.create({
      salesman: ahmadUser._id,
      customer: jawwadCustomer._id,
      customerName: jawwadCustomer.name || jawwadCustomer.firstName,
      customerEmail: jawwadCustomer.email,
      customerPhone: jawwadCustomer.phone,
      product: sampleProduct._id,
      productName: sampleProduct.productName,
      productCode: sampleProduct.productCode,
      quantity: 1,
      status: 'Pending',
      visitTarget: visitRequest._id,
      visitDate: visitDate,
      expectedDate: new Date(visitDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from visit
      notes: `Sample tracking created by admin for customer ${jawwadCustomer.name}`,
      createdBy: adminUser._id
    });

    logSuccess(`Created sample track: ${sampleTrack.sampleNumber}`);
    logInfo(`Product: ${sampleProduct.productName}`);
    logInfo(`Customer: ${jawwadCustomer.name}`);
    logInfo(`Status: ${sampleTrack.status}\n`);

    // Step 10: Final Summary
    logStep('Final Summary - Full Flow Test');
    logSuccess(`✅ Ahmad User: ${ahmadUser.email || ahmadUser.name}`);
    logSuccess(`✅ Customer: ${jawwadCustomer.name}`);
    logSuccess(`✅ Tasks Created: ${createdTasks.length} (All Approved)`);
    logSuccess(`✅ Visit Request Created: ${visitRequest.name} (Approved)`);
    logSuccess(`✅ Visit Linked to Task: ${visitTask ? visitTask.followUpNumber : 'N/A'}`);
    logSuccess(`✅ Admin Follow-up Created: ${adminFollowUp.followUpNumber}`);
    logSuccess(`✅ Sample Track Created: ${sampleTrack.sampleNumber}`);
    
    log('\n' + '='.repeat(70), 'green');
    logSuccess('✅ Full Flow Test Completed Successfully!');
    log('='.repeat(70) + '\n', 'green');
    
    logInfo('You can now check:');
    logInfo('  - Salesman Dashboard: Tasks (should show approved tasks)');
    logInfo('  - Salesman Dashboard: Visit Requests (should show approved visit)');
    logInfo('  - Admin Dashboard: Tasks (should show all tasks)');
    logInfo('  - Admin Dashboard: Sample Tracking (should show sample)');
    logInfo('  - All tasks are linked to customer Jawwad');
    logInfo('  - Visit is in Karachi location');
    log('');

    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    process.exit(1);
  }
}

// Run the script
main();
