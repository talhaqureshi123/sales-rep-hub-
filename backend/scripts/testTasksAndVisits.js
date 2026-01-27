const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const VisitTarget = require('../database/models/VisitTarget');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');

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

const testTasksAndVisits = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Get first available admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ No admin found. Please create an admin first.');
      process.exit(1);
    }
    console.log(`👤 Using Admin: ${admin.name} (${admin.email})`);

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

    // ============================================
    // 1. CREATE TASK (FOLLOW-UP)
    // ============================================
    console.log('\n📋 Creating Task (Follow-up)...\n');

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
      notes: 'Test task created by testTasksAndVisits.js script',
      createdBy: admin._id,
      approvalStatus: 'Approved', // Admin-created tasks are auto-approved
      approvedBy: admin._id,
      approvedAt: new Date(),
      source: 'app', // Mark as app-created task
    };

    const task = await FollowUp.create(taskData);
    const populatedTask = await FollowUp.findById(task._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name firstName email phone')
      .populate('createdBy', 'name email');

    console.log('✅ Task Created Successfully!\n');
    console.log('📋 Task Details:');
    console.log(`   Follow-up Number: ${populatedTask.followUpNumber}`);
    console.log(`   Type: ${populatedTask.type}`);
    console.log(`   Priority: ${populatedTask.priority}`);
    console.log(`   Status: ${populatedTask.status}`);
    console.log(`   Salesman: ${populatedTask.salesman.name} (${populatedTask.salesman.email})`);
    console.log(`   Customer: ${populatedTask.customerName}`);
    console.log(`   Description: ${populatedTask.description}`);
    console.log(`   Due Date: ${populatedTask.dueDate.toLocaleDateString()}`);
    console.log(`   Approval Status: ${populatedTask.approvalStatus}`);
    console.log(`   Created By: ${populatedTask.createdBy.name} (${populatedTask.createdBy.email})`);
    console.log(`   🆔 Task ID: ${populatedTask._id}`);

    // ============================================
    // 2. CREATE VISIT TARGET
    // ============================================
    console.log('\n\n📍 Creating Visit Target...\n');

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 3); // 3 days from now

    // Use customer location or default to Karachi
    const latitude = customer.latitude || 24.8607;
    const longitude = customer.longitude || 67.0011;

    const visitData = {
      name: `${customer.name || customer.firstName} - Visit`,
      description: `Visit to ${customer.name || customer.firstName} for product demonstration`,
      salesman: salesman._id,
      priority: 'High',
      visitDate: visitDate,
      status: 'Pending',
      approvalStatus: 'Approved', // Admin-created visits are auto-approved
      approvedBy: admin._id,
      approvedAt: new Date(),
      // Location
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      address: customer.address || '123 Main Street',
      city: customer.city || 'Karachi',
      state: customer.state || 'Sindh',
      pincode: customer.postcode || customer.pincode || '75000',
      // Customer information
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerId: customer._id,
      notes: 'Test visit created by testTasksAndVisits.js script',
      createdBy: admin._id,
    };

    const visit = await VisitTarget.create(visitData);
    const populatedVisit = await VisitTarget.findById(visit._id)
      .populate('salesman', 'name email')
      .populate('customerId', 'name firstName email phone')
      .populate('createdBy', 'name email');

    console.log('✅ Visit Target Created Successfully!\n');
    console.log('📍 Visit Details:');
    console.log(`   Name: ${populatedVisit.name}`);
    console.log(`   Description: ${populatedVisit.description}`);
    console.log(`   Priority: ${populatedVisit.priority}`);
    console.log(`   Status: ${populatedVisit.status}`);
    console.log(`   Salesman: ${populatedVisit.salesman.name} (${populatedVisit.salesman.email})`);
    console.log(`   Customer: ${populatedVisit.customerName}`);
    console.log(`   Visit Date: ${new Date(populatedVisit.visitDate).toLocaleDateString()}`);
    console.log(`   Approval Status: ${populatedVisit.approvalStatus}`);
    console.log(`   Location: ${populatedVisit.address}, ${populatedVisit.city}, ${populatedVisit.state}`);
    console.log(`   Coordinates: ${populatedVisit.latitude}, ${populatedVisit.longitude}`);
    console.log(`   Created By: ${populatedVisit.createdBy.name} (${populatedVisit.createdBy.email})`);
    console.log(`   🆔 Visit ID: ${populatedVisit._id}`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n\n📊 Summary:');
    console.log('✅ Task (Follow-up) created successfully');
    console.log('✅ Visit Target created successfully');
    console.log('\n✅ Test completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tasks/visits:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the test
if (require.main === module) {
  testTasksAndVisits();
}

module.exports = testTasksAndVisits;
