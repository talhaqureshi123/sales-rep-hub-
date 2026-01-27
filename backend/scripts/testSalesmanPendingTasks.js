const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const VisitTarget = require('../database/models/VisitTarget');
const Sample = require('../database/models/Sample');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');

// Generate unique follow-up number
const generateFollowUpNumber = async () => {
  let followUpNumber;
  let isUnique = false;
  while (!isUnique) {
    const prefix = 'FU';
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    followUpNumber = `${prefix}${randomNum}`;
    const exists = await FollowUp.findOne({ followUpNumber });
    if (!exists) {
      isUnique = true;
    }
  }
  return followUpNumber;
};

const testSalesmanPendingTasks = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');
    console.log('📋 Creating PENDING Tasks and Visits from Salesman...\n');
    console.log('ℹ️  These will appear in Admin Tasks page under "Pending Approval" tab\n');

    // Get first available salesman
    const salesman = await User.findOne({ role: 'salesman' });
    if (!salesman) {
      console.log('❌ No salesman found. Please create a salesman first.');
      process.exit(1);
    }
    console.log(`👤 Using Salesman: ${salesman.name} (${salesman.email})`);

    // Get first available customer
    const customer = await Customer.findOne();
    if (!customer) {
      console.log('❌ No customer found. Please create a customer first.');
      process.exit(1);
    }
    console.log(`👥 Using Customer: ${customer.name || customer.firstName} (${customer.email || 'No email'})`);

    // Get first available product
    const product = await Product.findOne();
    if (!product) {
      console.log('⚠️  No product found. Sample will be created without product reference.');
    } else {
      console.log(`📦 Using Product: ${product.name} (${product.productCode || 'No code'})`);
    }

    // ============================================
    // 1. CREATE TASK (FOLLOW-UP) - PENDING APPROVAL
    // ============================================
    console.log('\n📋 Creating Task (Follow-up) with PENDING approval...\n');

    const followUpNumber = await generateFollowUpNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 days from now

    const taskData = {
      followUpNumber: followUpNumber,
      salesman: salesman._id,
      customer: customer._id,
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
      type: 'Call',
      priority: 'High',
      status: 'Upcoming',
      scheduledDate: dueDate,
      dueDate: dueDate,
      description: `Follow up with ${customer.name || customer.firstName} regarding product inquiry`,
      notes: 'Test task created by salesman - needs admin approval',
      createdBy: salesman._id, // IMPORTANT: Created by salesman
      approvalStatus: 'Pending', // IMPORTANT: Pending approval
      // NO approvedBy or approvedAt - waiting for admin approval
      source: 'app', // Mark as app-created task
    };

    const task = await FollowUp.create(taskData);
    const populatedTask = await FollowUp.findById(task._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name firstName email phone')
      .populate('createdBy', 'name email role');

    console.log('✅ Task Created Successfully (PENDING Approval)!\n');
    console.log('📋 Task Details:');
    console.log(`   Follow-up Number: ${populatedTask.followUpNumber}`);
    console.log(`   Type: ${populatedTask.type}`);
    console.log(`   Priority: ${populatedTask.priority}`);
    console.log(`   Status: ${populatedTask.status}`);
    console.log(`   Salesman: ${populatedTask.salesman.name} (${populatedTask.salesman.email})`);
    console.log(`   Customer: ${populatedTask.customerName}`);
    console.log(`   Description: ${populatedTask.description}`);
    console.log(`   Due Date: ${populatedTask.dueDate.toLocaleDateString()}`);
    console.log(`   ⚠️  Approval Status: ${populatedTask.approvalStatus} (PENDING)`);
    console.log(`   Created By: ${populatedTask.createdBy.name} (${populatedTask.createdBy.email}) - Role: ${populatedTask.createdBy.role}`);
    console.log(`   🆔 Task ID: ${populatedTask._id}`);
    console.log(`\n   ✅ This task will appear in Admin Tasks page under "Pending Approval" tab`);

    // ============================================
    // 2. CREATE VISIT TARGET - PENDING APPROVAL
    // ============================================
    console.log('\n\n📍 Creating Visit Target with PENDING approval...\n');

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 3); // 3 days from now

    // Use customer location or default to Karachi
    const latitude = customer.latitude || 24.8607;
    const longitude = customer.longitude || 67.0011;

    const visitData = {
      name: `${customer.name || customer.firstName} - Visit Request`,
      description: `Visit request to ${customer.name || customer.firstName} for product demonstration`,
      salesman: salesman._id,
      priority: 'High',
      visitDate: visitDate,
      status: 'Pending',
      approvalStatus: 'Pending', // IMPORTANT: Pending approval
      // NO approvedBy or approvedAt - waiting for admin approval
      // Location
      latitude: latitude,
      longitude: longitude,
      address: customer.address || '123 Main Street',
      city: customer.city || 'Karachi',
      state: customer.state || 'Sindh',
      pincode: customer.postcode || customer.pincode || '75000',
      // Customer information
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerId: customer._id,
      notes: 'Test visit request created by salesman - needs admin approval',
      createdBy: salesman._id, // IMPORTANT: Created by salesman
    };

    const visit = await VisitTarget.create(visitData);
    const populatedVisit = await VisitTarget.findById(visit._id)
      .populate('salesman', 'name email')
      .populate('customerId', 'name firstName email phone')
      .populate('createdBy', 'name email role');

    console.log('✅ Visit Target Created Successfully (PENDING Approval)!\n');
    console.log('📍 Visit Details:');
    console.log(`   Name: ${populatedVisit.name}`);
    console.log(`   Description: ${populatedVisit.description}`);
    console.log(`   Priority: ${populatedVisit.priority}`);
    console.log(`   Status: ${populatedVisit.status}`);
    console.log(`   Salesman: ${populatedVisit.salesman.name} (${populatedVisit.salesman.email})`);
    console.log(`   Customer: ${populatedVisit.customerName}`);
    console.log(`   Visit Date: ${new Date(populatedVisit.visitDate).toLocaleDateString()}`);
    console.log(`   ⚠️  Approval Status: ${populatedVisit.approvalStatus} (PENDING)`);
    console.log(`   Location: ${populatedVisit.address}, ${populatedVisit.city}, ${populatedVisit.state}`);
    console.log(`   Coordinates: ${populatedVisit.latitude}, ${populatedVisit.longitude}`);
    console.log(`   Created By: ${populatedVisit.createdBy.name} (${populatedVisit.createdBy.email}) - Role: ${populatedVisit.createdBy.role}`);
    console.log(`   🆔 Visit ID: ${populatedVisit._id}`);
    console.log(`\n   ✅ This visit will appear in Admin Tasks page under "Pending Approval" tab`);

    // ============================================
    // 3. CREATE SAMPLE TRACK - PENDING APPROVAL
    // ============================================
    console.log('\n\n🧪 Creating Sample Track with PENDING approval...\n');

    const visitDateForSample = new Date();
    visitDateForSample.setDate(visitDateForSample.getDate() + 5); // 5 days from now

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 10); // 10 days from now

    const sampleData = {
      salesman: salesman._id,
      customer: customer._id,
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
      product: product?._id || undefined,
      productName: product?.name || 'Test Product Sample',
      productCode: product?.productCode || 'PROD-SAMPLE-001',
      quantity: 2,
      status: 'Pending',
      visitDate: visitDateForSample,
      expectedDate: expectedDate,
      notes: 'Test sample track created by salesman - needs admin approval',
      createdBy: salesman._id, // IMPORTANT: Created by salesman
    };

    const sample = await Sample.create(sampleData);
    const populatedSample = await Sample.findById(sample._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name firstName email phone')
      .populate('product', 'name productCode price')
      .populate('createdBy', 'name email role');

    console.log('✅ Sample Track Created Successfully (PENDING Approval)!\n');
    console.log('🧪 Sample Details:');
    console.log(`   Sample Number: ${populatedSample.sampleNumber}`);
    console.log(`   Product: ${populatedSample.productName} (${populatedSample.productCode || 'No code'})`);
    console.log(`   Quantity: ${populatedSample.quantity}`);
    console.log(`   Status: ${populatedSample.status}`);
    console.log(`   Salesman: ${populatedSample.salesman.name} (${populatedSample.salesman.email})`);
    console.log(`   Customer: ${populatedSample.customerName}`);
    console.log(`   Visit Date: ${new Date(populatedSample.visitDate).toLocaleDateString()}`);
    console.log(`   Expected Date: ${populatedSample.expectedDate ? new Date(populatedSample.expectedDate).toLocaleDateString() : 'N/A'}`);
    console.log(`   Created By: ${populatedSample.createdBy.name} (${populatedSample.createdBy.email}) - Role: ${populatedSample.createdBy.role}`);
    console.log(`   🆔 Sample ID: ${populatedSample._id}`);
    console.log(`\n   ✅ This sample track will appear in Admin Tasks page under "Pending Approval" tab`);

    // Also create a Sample Feedback task for this sample
    console.log('\n📋 Creating Sample Feedback Task for the sample...\n');
    
    const sampleTaskFollowUpNumber = await generateFollowUpNumber();
    const sampleTaskDueDate = new Date();
    sampleTaskDueDate.setDate(sampleTaskDueDate.getDate() + 7);

    const sampleTaskData = {
      followUpNumber: sampleTaskFollowUpNumber,
      salesman: salesman._id,
      customer: customer._id,
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
      type: 'Sample Feedback',
      priority: 'High',
      status: 'Upcoming',
      scheduledDate: sampleTaskDueDate,
      dueDate: sampleTaskDueDate,
      description: `Sample feedback for ${populatedSample.productName} - ${populatedSample.customerName}`,
      notes: `Sample Number: ${populatedSample.sampleNumber}. Test sample feedback task created by salesman - needs admin approval`,
      relatedSample: populatedSample._id,
      createdBy: salesman._id, // IMPORTANT: Created by salesman
      approvalStatus: 'Pending', // IMPORTANT: Pending approval
      source: 'app', // Mark as app-created task
    };

    const sampleTask = await FollowUp.create(sampleTaskData);
    const populatedSampleTask = await FollowUp.findById(sampleTask._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name firstName email phone')
      .populate('relatedSample', 'sampleNumber productName')
      .populate('createdBy', 'name email role');

    console.log('✅ Sample Feedback Task Created Successfully (PENDING Approval)!\n');
    console.log('📋 Sample Task Details:');
    console.log(`   Follow-up Number: ${populatedSampleTask.followUpNumber}`);
    console.log(`   Type: ${populatedSampleTask.type}`);
    console.log(`   Priority: ${populatedSampleTask.priority}`);
    console.log(`   Status: ${populatedSampleTask.status}`);
    console.log(`   Salesman: ${populatedSampleTask.salesman.name} (${populatedSampleTask.salesman.email})`);
    console.log(`   Customer: ${populatedSampleTask.customerName}`);
    console.log(`   Description: ${populatedSampleTask.description}`);
    console.log(`   Related Sample: ${populatedSampleTask.relatedSample?.sampleNumber || 'N/A'}`);
    console.log(`   Due Date: ${populatedSampleTask.dueDate.toLocaleDateString()}`);
    console.log(`   ⚠️  Approval Status: ${populatedSampleTask.approvalStatus} (PENDING)`);
    console.log(`   Created By: ${populatedSampleTask.createdBy.name} (${populatedSampleTask.createdBy.email}) - Role: ${populatedSampleTask.createdBy.role}`);
    console.log(`   🆔 Task ID: ${populatedSampleTask._id}`);
    console.log(`\n   ✅ This sample feedback task will appear in Admin Tasks page under "Pending Approval" tab`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n\n📊 Summary:');
    console.log('✅ Task (Follow-up) created with PENDING approval status');
    console.log('✅ Visit Target created with PENDING approval status');
    console.log('✅ Sample Track created');
    console.log('✅ Sample Feedback Task created with PENDING approval status');
    console.log('\n📌 Next Steps:');
    console.log('   1. Go to Admin Dashboard → Tasks page');
    console.log('   2. Click on "Pending Approval" tab');
    console.log('   3. You should see all tasks, visits, and sample feedback tasks listed there');
    console.log('   4. Admin can approve/reject them from there');
    console.log('\n✅ Test completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating pending tasks/visits:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the test
if (require.main === module) {
  testSalesmanPendingTasks();
}

module.exports = testSalesmanPendingTasks;
