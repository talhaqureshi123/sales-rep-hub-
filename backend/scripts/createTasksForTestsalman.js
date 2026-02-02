/**
 * Create sample tasks for salesman named "testsalman"
 *
 * Usage:
 *   node scripts/createTasksForTestsalman.js
 *
 * - Finds salesman by name "testsalman" (case-insensitive) or email containing "testsalman"
 * - Creates a few sample follow-up tasks assigned to that salesman
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const User = require('../database/models/User');

const SALESMAN_NAME_SEARCH = 'testsalman';

async function main() {
  await connectDB();

  try {
    // Find salesman: name = testsalman (case-insensitive) or email contains testsalman
    const salesman = await User.findOne({
      role: 'salesman',
      $or: [
        { name: new RegExp(SALESMAN_NAME_SEARCH, 'i') },
        { email: new RegExp(SALESMAN_NAME_SEARCH, 'i') },
      ],
    }).select('_id name email');

    if (!salesman) {
      console.log('❌ No salesman found with name or email containing "' + SALESMAN_NAME_SEARCH + '".');
      console.log('   Create a salesman user with name "testsalman" (or email like testsalman@...) and run again.');
      process.exit(1);
    }

    // createdBy is required – use any admin, else salesman
    const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
    const createdBy = (admin && admin._id) || salesman._id;

    console.log('✅ Salesman found:', salesman.name || salesman.email, `(${salesman.email})`);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const tasksToCreate = [
      {
        salesman: salesman._id,
        createdBy,
        customerName: 'Sample Customer A',
        customerEmail: 'customera@example.com',
        type: 'Call',
        priority: 'Medium',
        scheduledDate: tomorrow,
        dueDate: tomorrow,
        description: 'Follow up call - testsalman task 1',
        notes: 'Task created for salesman testsalman',
        approvalStatus: 'Approved',
        source: 'app',
      },
      {
        salesman: salesman._id,
        createdBy,
        customerName: 'Sample Customer B',
        customerEmail: 'customerb@example.com',
        type: 'Visit',
        priority: 'High',
        scheduledDate: dayAfter,
        dueDate: dayAfter,
        description: 'Site visit - testsalman task 2',
        notes: 'Visit scheduled for testsalman',
        approvalStatus: 'Approved',
        source: 'app',
      },
      {
        salesman: salesman._id,
        createdBy,
        customerName: 'Sample Customer C',
        type: 'Meeting',
        priority: 'Medium',
        scheduledDate: tomorrow,
        dueDate: tomorrow,
        description: 'Meeting follow-up - testsalman task 3',
        notes: 'Meeting task for testsalman',
        approvalStatus: 'Approved',
        source: 'app',
      },
    ];

    let created = 0;
    for (const data of tasksToCreate) {
      const task = await FollowUp.create(data);
      console.log('   Created task:', task.followUpNumber, '-', data.description);
      created++;
    }

    console.log('✅ Done. Created', created, 'tasks for salesman', salesman.name || salesman.email);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
