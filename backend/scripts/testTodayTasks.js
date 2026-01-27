const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
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

const testTodayTasks = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');
    console.log('📋 Creating TODAY Tasks from Admin for Sales Tracking Test...\n');

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

    // Get 2 different customers
    const customers = await Customer.find().limit(2);
    if (customers.length < 2) {
      console.log('❌ Need at least 2 customers. Please create more customers first.');
      process.exit(1);
    }
    console.log(`👥 Using Customers:`);
    customers.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name || c.firstName} (${c.email || 'No email'})`);
    });

    // Set today's date (start of day)
    const today = new Date();
    today.setHours(9, 0, 0, 0); // 9 AM today

    // Set due date to today (end of day)
    const dueDate = new Date();
    dueDate.setHours(17, 0, 0, 0); // 5 PM today

    const createdTasks = [];

    // ============================================
    // CREATE 2 TODAY TASKS
    // ============================================
    for (let i = 0; i < 2; i++) {
      const customer = customers[i];
      console.log(`\n📋 Creating Task ${i + 1} for TODAY...\n`);

      const followUpNumber = await generateFollowUpNumber();

      const taskData = {
        followUpNumber: followUpNumber,
        salesman: salesman._id,
        customer: customer._id,
        customerName: customer.name || customer.firstName || 'Test Customer',
        customerEmail: customer.email || '',
        customerPhone: customer.phone || '',
        type: i === 0 ? 'Visit' : 'Call', // First task is Visit, second is Call
        priority: i === 0 ? 'High' : 'Medium',
        status: 'Today', // IMPORTANT: Status is Today
        scheduledDate: today,
        dueDate: dueDate,
        description: `Today's task ${i + 1}: ${i === 0 ? 'Visit' : 'Call'} with ${customer.name || customer.firstName}`,
        notes: `Test task created by admin for today. This task needs to be started with meter picture.`,
        createdBy: admin._id, // Created by admin
        approvalStatus: 'Approved', // Auto-approved (admin created)
        approvedBy: admin._id,
        approvedAt: new Date(),
        source: 'app', // Mark as app-created task
        // NOT started yet - will be started manually with meter picture
      };

      const task = await FollowUp.create(taskData);
      const populatedTask = await FollowUp.findById(task._id)
        .populate('salesman', 'name email')
        .populate('customer', 'name firstName email phone')
        .populate('createdBy', 'name email role');

      createdTasks.push(populatedTask);

      console.log(`✅ Task ${i + 1} Created Successfully!\n`);
      console.log(`📋 Task Details:`);
      console.log(`   Follow-up Number: ${populatedTask.followUpNumber}`);
      console.log(`   Type: ${populatedTask.type}`);
      console.log(`   Priority: ${populatedTask.priority}`);
      console.log(`   Status: ${populatedTask.status} (TODAY)`);
      console.log(`   Salesman: ${populatedTask.salesman.name} (${populatedTask.salesman.email})`);
      console.log(`   Customer: ${populatedTask.customerName}`);
      console.log(`   Description: ${populatedTask.description}`);
      console.log(`   Due Date: ${populatedTask.dueDate.toLocaleDateString()} ${populatedTask.dueDate.toLocaleTimeString()}`);
      console.log(`   Approval Status: ${populatedTask.approvalStatus}`);
      console.log(`   Created By: ${populatedTask.createdBy.name} (${populatedTask.createdBy.email}) - Role: ${populatedTask.createdBy.role}`);
      console.log(`   Started At: ${populatedTask.startedAt ? new Date(populatedTask.startedAt).toLocaleString() : 'Not started yet'}`);
      console.log(`   🆔 Task ID: ${populatedTask._id}`);
      console.log(`\n   ✅ This task will appear in Admin Tasks page under "Due today" tab`);
      console.log(`   ✅ You can click "Start Task" button to start it with meter picture`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n\n📊 Summary:');
    console.log(`✅ Created ${createdTasks.length} TODAY tasks successfully`);
    console.log('\n📋 Task Details:');
    createdTasks.forEach((task, index) => {
      console.log(`   ${index + 1}. ${task.followUpNumber} - ${task.type} - ${task.customerName} - Status: ${task.status}`);
    });
    console.log('\n📌 Next Steps for Testing:');
    console.log('   1. Go to Admin Dashboard → Tasks page');
    console.log('   2. Click on "Due today" tab');
    console.log('   3. You should see both tasks listed there');
    console.log('   4. Click "Start Task" button on any task');
    console.log('   5. Upload meter picture (required)');
    console.log('   6. Optionally enter meter reading');
    console.log('   7. Click "Start Task" to start');
    console.log('   8. Task will show "Started" badge after starting');
    console.log('\n✅ Test tasks created successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating today tasks:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the test
if (require.main === module) {
  testTodayTasks();
}

module.exports = testTodayTasks;
