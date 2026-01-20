/**
 * Task Creation & Functionality Test Script
 * 
 * Tests all task (FollowUp) functionality directly using database and models
 * NO HTTP API calls - Direct database access only
 * 
 * Usage:
 *   node scripts/taskTest.js
 * 
 * This script tests:
 *   - Admin task creation
 *   - Salesman task creation
 *   - Get all tasks
 *   - Get tasks by salesman
 *   - Update task
 *   - Delete task
 *   - Approve task
 *   - Reject task
 *   - Task statistics
 *   - Task filtering
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const bcrypt = require('bcryptjs');
const hubspotService = require('../services/hubspotService');
const hubspotOAuthService = require('../services/hubspotOAuthService');
const config = require('../config');

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
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
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
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }

    if (user.status !== 'Active') {
      return null;
    }

    return user;
  } catch (error) {
    logError(`Error verifying user: ${error.message}`);
    return null;
  }
}

// Test Admin Task Creation
async function testAdminTaskCreation(adminUser, salesmanId) {
  log('\n📋 Testing Admin Task Creation...', 'blue');

  try {
    const taskData = {
      salesman: salesmanId,
      customerName: 'Test Customer Admin',
      customerEmail: 'testadmin@example.com',
      customerPhone: '+923001234567',
      type: 'Call',
      priority: 'High',
      scheduledDate: new Date(Date.now() + 86400000), // Tomorrow
      dueDate: new Date(Date.now() + 86400000),
      description: 'Admin created test task - Call customer for follow-up',
      notes: 'This task was created by admin and should be auto-approved',
      createdBy: adminUser._id,
      approvalStatus: 'Approved', // Admin created tasks are auto-approved
    };

    const task = await FollowUp.create(taskData);
    const populatedTask = await FollowUp.findById(task._id)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email');

    logSuccess(`Task created: ${task.followUpNumber}`);
    logInfo(`Approval Status: ${task.approvalStatus}`);
    logInfo(`Status: ${task.status}`);
    logInfo(`Customer: ${task.customerName}`);
    logInfo(`Type: ${task.type}`);
    logInfo(`Priority: ${task.priority}`);

    // 🔁 HUBSPOT SYNC (NON-BLOCKING): create task in HubSpot when follow-up is created
    if (task.approvalStatus === 'Approved') {
      (async () => {
        try {
          const subject = taskData.description || `Follow-up: ${taskData.customerName}`;
          const body = taskData.notes || '';

          // Map local priority to HubSpot priority values
          let hsPriority = 'NONE';
          const pr = (taskData.priority || task.priority || '').toLowerCase();
          if (pr === 'urgent' || pr === 'high') hsPriority = 'HIGH';
          else if (pr === 'medium') hsPriority = 'MEDIUM';
          else if (pr === 'low') hsPriority = 'LOW';

          const hubspotTaskId = await hubspotService.createTaskObjectInHubSpot({
            subject,
            body,
            status: 'NOT_STARTED',
            priority: hsPriority,
            type: 'TODO',
            dueDate: task.dueDate,
          });

          if (hubspotTaskId) {
            task.hubspotTaskId = hubspotTaskId;
            await task.save();
            logSuccess(`✅ Task synced to HubSpot: ${hubspotTaskId}`);
          } else {
            logWarning('⚠️  HubSpot sync failed - check HubSpot token configuration');
          }
        } catch (e) {
          logError(`HubSpot follow-up task sync error: ${e.message}`);
        }
      })();
    }

    return populatedTask;
  } catch (error) {
    logError(`Failed to create admin task: ${error.message}`);
    return null;
  }
}

// Test Salesman Task Creation
async function testSalesmanTaskCreation(salesmanUser) {
  log('\n📋 Testing Salesman Task Creation...', 'blue');

  try {
    const taskData = {
      salesman: salesmanUser._id,
      customerName: 'Test Customer Salesman',
      customerEmail: 'testsalesman@example.com',
      customerPhone: '+923009876543',
      type: 'Visit',
      priority: 'Medium',
      scheduledDate: new Date(Date.now() + 2 * 86400000), // Day after tomorrow
      dueDate: new Date(Date.now() + 2 * 86400000),
      description: 'Salesman created test task - Visit customer location',
      notes: 'This task was created by salesman and needs admin approval',
      createdBy: salesmanUser._id,
      approvalStatus: 'Pending', // Salesman tasks need admin approval
    };

    const task = await FollowUp.create(taskData);
    const populatedTask = await FollowUp.findById(task._id)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email');

    logSuccess(`Task created: ${task.followUpNumber}`);
    logInfo(`Approval Status: ${task.approvalStatus}`);
    logInfo(`Status: ${task.status}`);
    logInfo(`Customer: ${task.customerName}`);
    logInfo(`Type: ${task.type}`);
    logInfo(`Priority: ${task.priority}`);

    // ❌ NO HUBSPOT SYNC - Will be posted to HubSpot only after admin approval
    logInfo('⏳ HubSpot sync pending - waiting for admin approval');

    return populatedTask;
  } catch (error) {
    logError(`Failed to create salesman task: ${error.message}`);
    return null;
  }
}

// Test Get All Tasks
async function testGetAllTasks() {
  log('\n📋 Testing Get All Tasks...', 'blue');

  try {
    // Build query with optional populate for customer
    let query = FollowUp.find()
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1, priority: -1 });

    // Only populate customer if Customer model is registered
    try {
      if (mongoose.models.Customer) {
        query = query.populate('customer', 'name email phone');
      }
    } catch (e) {
      // Customer model not available, skip populate
    }

    const tasks = await query;

    logSuccess(`Total tasks found: ${tasks.length}`);
    
    if (tasks.length > 0) {
      logInfo(`First task: ${tasks[0].followUpNumber} - ${tasks[0].customerName}`);
      logInfo(`Last task: ${tasks[tasks.length - 1].followUpNumber} - ${tasks[tasks.length - 1].customerName}`);
    }

    return tasks;
  } catch (error) {
    logError(`Failed to get all tasks: ${error.message}`);
    return null;
  }
}

// Test Get Tasks by Salesman
async function testGetTasksBySalesman(salesmanId) {
  log('\n📋 Testing Get Tasks by Salesman...', 'blue');

  try {
    let query = FollowUp.find({ salesman: salesmanId })
      .populate('salesman', 'name email')
      .sort({ dueDate: 1, priority: -1 });

    // Only populate customer if Customer model is registered
    try {
      if (mongoose.models.Customer) {
        query = query.populate('customer', 'name email phone');
      }
    } catch (e) {
      // Customer model not available, skip populate
    }

    const tasks = await query;

    logSuccess(`Tasks for salesman: ${tasks.length}`);
    
    if (tasks.length > 0) {
      tasks.forEach((task, index) => {
        logInfo(`${index + 1}. ${task.followUpNumber} - ${task.customerName} (${task.status})`);
      });
    }

    return tasks;
  } catch (error) {
    logError(`Failed to get tasks by salesman: ${error.message}`);
    return null;
  }
}

// Test Get Single Task
async function testGetSingleTask(taskId) {
  log('\n📋 Testing Get Single Task...', 'blue');

  try {
    let query = FollowUp.findById(taskId)
      .populate('salesman', 'name email phone')
      .populate('createdBy', 'name email role');

    // Only populate customer if Customer model is registered
    try {
      if (mongoose.models.Customer) {
        query = query.populate('customer', 'name email phone address');
      }
    } catch (e) {
      // Customer model not available, skip populate
    }

    const task = await query;

    if (!task) {
      logError('Task not found');
      return null;
    }

    logSuccess(`Task found: ${task.followUpNumber}`);
    logInfo(`Customer: ${task.customerName}`);
    logInfo(`Type: ${task.type}`);
    logInfo(`Priority: ${task.priority}`);
    logInfo(`Status: ${task.status}`);
    logInfo(`Approval Status: ${task.approvalStatus}`);
    logInfo(`Due Date: ${task.dueDate}`);

    return task;
  } catch (error) {
    logError(`Failed to get single task: ${error.message}`);
    return null;
  }
}

// Test Update Task
async function testUpdateTask(taskId, adminUser) {
  log('\n📋 Testing Update Task...', 'blue');

  try {
    const task = await FollowUp.findById(taskId);
    if (!task) {
      logError('Task not found');
      return null;
    }

    task.priority = 'Urgent';
    task.description = 'Updated description - Task priority changed to Urgent';
    task.notes = 'Task updated by admin test script';
    await task.save();

    const updatedTask = await FollowUp.findById(taskId)
      .populate('salesman', 'name email');

    logSuccess(`Task updated: ${updatedTask.followUpNumber}`);
    logInfo(`New priority: ${updatedTask.priority}`);
    logInfo(`New description: ${updatedTask.description}`);

    return updatedTask;
  } catch (error) {
    logError(`Failed to update task: ${error.message}`);
    return null;
  }
}

// Test Update Task Status (Salesman)
async function testUpdateTaskStatus(taskId, salesmanUser) {
  log('\n📋 Testing Update Task Status (Salesman)...', 'blue');

  try {
    const task = await FollowUp.findOne({
      _id: taskId,
      salesman: salesmanUser._id,
    });

    if (!task) {
      logError('Task not found or not assigned to salesman');
      return null;
    }

    task.notes = 'Added notes by salesman - Task in progress';
    await task.save();

    logSuccess(`Task updated: ${task.followUpNumber}`);
    logInfo(`Notes: ${task.notes}`);

    return task;
  } catch (error) {
    logError(`Failed to update task status: ${error.message}`);
    return null;
  }
}

// Test Approve Task
async function testApproveTask(taskId, adminUser) {
  log('\n📋 Testing Approve Task...', 'blue');

  try {
    const task = await FollowUp.findById(taskId);
    if (!task) {
      logError('Task not found');
      return null;
    }

    if (task.approvalStatus === 'Approved') {
      logWarning('Task is already approved');
      return task;
    }

    task.approvalStatus = 'Approved';
    task.approvedBy = adminUser._id;
    task.approvedAt = new Date();
    await task.save();

    // 🔁 HUBSPOT SYNC (NON-BLOCKING): create task in HubSpot when approved
    (async () => {
      try {
        const subject = task.description || `Follow-up: ${task.customerName}`;
        const body = task.notes || '';

        // Map local priority to HubSpot priority values
        let hsPriority = 'NONE';
        const pr = (task.priority || '').toLowerCase();
        if (pr === 'urgent' || pr === 'high') hsPriority = 'HIGH';
        else if (pr === 'medium') hsPriority = 'MEDIUM';
        else if (pr === 'low') hsPriority = 'LOW';

        const hubspotTaskId = await hubspotService.createTaskObjectInHubSpot({
          subject,
          body,
          status: 'NOT_STARTED',
          priority: hsPriority,
          type: 'TODO',
          dueDate: task.dueDate,
        });

        if (hubspotTaskId) {
          task.hubspotTaskId = hubspotTaskId;
          await task.save();
          logSuccess(`✅ Task synced to HubSpot: ${hubspotTaskId}`);
        } else {
          logWarning('⚠️  HubSpot sync failed - check HubSpot token configuration');
        }
      } catch (e) {
        logError(`HubSpot follow-up task sync error: ${e.message}`);
      }
    })();

    const approvedTask = await FollowUp.findById(taskId)
      .populate('salesman', 'name email')
      .populate('approvedBy', 'name email');

    logSuccess(`Task approved: ${approvedTask.followUpNumber}`);
    logInfo(`Approval Status: ${approvedTask.approvalStatus}`);
    logInfo(`Approved By: ${approvedTask.approvedBy?.name || 'N/A'}`);

    return approvedTask;
  } catch (error) {
    logError(`Failed to approve task: ${error.message}`);
    return null;
  }
}

// Test Reject Task
async function testRejectTask(taskId, adminUser) {
  log('\n📋 Testing Reject Task...', 'blue');

  try {
    const task = await FollowUp.findById(taskId);
    if (!task) {
      logError('Task not found');
      return null;
    }

    if (task.approvalStatus === 'Rejected') {
      logWarning('Task is already rejected');
      return task;
    }

    task.approvalStatus = 'Rejected';
    task.approvedBy = adminUser._id;
    task.approvedAt = new Date();
    task.rejectionReason = 'Test rejection - Task does not meet requirements';
    await task.save();

    const rejectedTask = await FollowUp.findById(taskId)
      .populate('salesman', 'name email')
      .populate('approvedBy', 'name email');

    logSuccess(`Task rejected: ${rejectedTask.followUpNumber}`);
    logInfo(`Approval Status: ${rejectedTask.approvalStatus}`);
    logInfo(`Rejection Reason: ${rejectedTask.rejectionReason}`);

    return rejectedTask;
  } catch (error) {
    logError(`Failed to reject task: ${error.message}`);
    return null;
  }
}

// Test Complete Task
async function testCompleteTask(taskId, salesmanUser) {
  log('\n📋 Testing Complete Task...', 'blue');

  try {
    const task = await FollowUp.findOne({
      _id: taskId,
      salesman: salesmanUser._id,
    });

    if (!task) {
      logError('Task not found or not assigned to salesman');
      return null;
    }

    if (task.approvalStatus !== 'Approved') {
      logWarning('Task must be approved before completion');
      return null;
    }

    task.status = 'Completed';
    task.completedDate = new Date();
    task.notes = (task.notes || '') + '\nTask completed successfully';
    await task.save();

    logSuccess(`Task completed: ${task.followUpNumber}`);
    logInfo(`Status: ${task.status}`);
    logInfo(`Completed Date: ${task.completedDate}`);

    return task;
  } catch (error) {
    logError(`Failed to complete task: ${error.message}`);
    return null;
  }
}

// Test Task Statistics
async function testTaskStatistics() {
  log('\n📋 Testing Task Statistics...', 'blue');

  try {
    const total = await FollowUp.countDocuments();
    const overdue = await FollowUp.countDocuments({ status: 'Overdue' });
    const today = await FollowUp.countDocuments({ status: 'Today' });
    const upcoming = await FollowUp.countDocuments({ status: 'Upcoming' });
    const completed = await FollowUp.countDocuments({ status: 'Completed' });
    const pendingApproval = await FollowUp.countDocuments({ approvalStatus: 'Pending' });
    const approved = await FollowUp.countDocuments({ approvalStatus: 'Approved' });
    const rejected = await FollowUp.countDocuments({ approvalStatus: 'Rejected' });

    logSuccess('Task Statistics:');
    logInfo(`Total Tasks: ${total}`);
    logInfo(`Overdue: ${overdue}`);
    logInfo(`Today: ${today}`);
    logInfo(`Upcoming: ${upcoming}`);
    logInfo(`Completed: ${completed}`);
    logInfo(`Pending Approval: ${pendingApproval}`);
    logInfo(`Approved: ${approved}`);
    logInfo(`Rejected: ${rejected}`);

    return {
      total,
      overdue,
      today,
      upcoming,
      completed,
      pendingApproval,
      approved,
      rejected,
    };
  } catch (error) {
    logError(`Failed to get task statistics: ${error.message}`);
    return null;
  }
}

// Test Task Filtering
async function testTaskFiltering() {
  log('\n📋 Testing Task Filtering...', 'blue');

  try {
    // Filter by status
    const upcomingTasks = await FollowUp.find({ status: 'Upcoming' });
    logInfo(`Upcoming tasks: ${upcomingTasks.length}`);

    // Filter by priority
    const highPriorityTasks = await FollowUp.find({ priority: 'High' });
    logInfo(`High priority tasks: ${highPriorityTasks.length}`);

    // Filter by type
    const callTasks = await FollowUp.find({ type: 'Call' });
    logInfo(`Call tasks: ${callTasks.length}`);

    // Filter by approval status
    const pendingTasks = await FollowUp.find({ approvalStatus: 'Pending' });
    logInfo(`Pending approval tasks: ${pendingTasks.length}`);

    // Search by customer name
    const testCustomerTasks = await FollowUp.find({
      customerName: { $regex: 'Test', $options: 'i' },
    });
    logInfo(`Tasks with "Test" in customer name: ${testCustomerTasks.length}`);

    // Filter by date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingWeekTasks = await FollowUp.find({
      dueDate: { $gte: tomorrow, $lte: nextWeek },
    });
    logInfo(`Tasks due in next week: ${upcomingWeekTasks.length}`);

    logSuccess('All filtering tests completed');

    return true;
  } catch (error) {
    logError(`Failed to test filtering: ${error.message}`);
    return false;
  }
}

// Test Delete Task
async function testDeleteTask(taskId) {
  log('\n📋 Testing Delete Task...', 'blue');

  try {
    const task = await FollowUp.findById(taskId);
    if (!task) {
      logError('Task not found');
      return false;
    }

    await FollowUp.findByIdAndDelete(taskId);
    logSuccess(`Task deleted: ${task.followUpNumber}`);

    return true;
  } catch (error) {
    logError(`Failed to delete task: ${error.message}`);
    return false;
  }
}

// Verify HubSpot Task Sync
async function verifyHubSpotTasks() {
  log('\n📋 Verifying HubSpot Task Sync...', 'blue');

  try {
    // Get all tasks with hubspotTaskId
    const syncedTasks = await FollowUp.find({
      hubspotTaskId: { $exists: true, $ne: null, $ne: '' }
    }).select('followUpNumber customerName hubspotTaskId createdAt description')
      .sort({ createdAt: -1 })
      .limit(10); // Get latest 10

    logInfo(`Total tasks with HubSpot ID (showing latest 10): ${syncedTasks.length}`);

    if (syncedTasks.length === 0) {
      logWarning('No tasks found with HubSpot ID');
      return;
    }

    // Try to verify tasks from HubSpot
    const axios = require('axios');
    
    // Get HubSpot token based on auth mode
    let hubspotToken = '';
    
    if (config.HUBSPOT_AUTH_MODE === 'oauth') {
      try {
        hubspotToken = await hubspotOAuthService.getValidAccessToken();
        logInfo('Using OAuth access token for verification');
      } catch (e) {
        logError(`OAuth token not available: ${e.message}`);
        logWarning('Falling back to static token if available...');
        hubspotToken = config.HUBSPOT_TOKEN || config.HUBSPOT_ACCESS_TOKEN || config.HUBSPOT_API_KEY;
      }
    } else {
      hubspotToken = config.HUBSPOT_TOKEN || config.HUBSPOT_ACCESS_TOKEN || config.HUBSPOT_API_KEY;
    }
    
    if (!hubspotToken) {
      logError('Cannot verify - HubSpot token not configured');
      logInfo('Tasks were created with HubSpot IDs, but verification requires valid token');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hubspotToken}`
    };

    logInfo('\nVerifying tasks in HubSpot...');
    let verifiedCount = 0;
    let failedCount = 0;

    // Check all synced tasks
    for (const task of syncedTasks) {
      try {
        const response = await axios.get(
          `https://api.hubapi.com/crm/v3/objects/tasks/${task.hubspotTaskId}`,
          {
            headers,
            params: {
              properties: 'hs_task_subject,hs_task_body,hs_task_status,hs_task_priority,hs_timestamp'
            }
          }
        );

        if (response.data) {
          verifiedCount++;
          logSuccess(`✅ ${task.followUpNumber} → HubSpot ID: ${task.hubspotTaskId}`);
          logInfo(`   Subject: ${response.data.properties?.hs_task_subject || 'N/A'}`);
          logInfo(`   Status: ${response.data.properties?.hs_task_status || 'N/A'}`);
        }
      } catch (error) {
        failedCount++;
        if (error.response?.status === 404) {
          logError(`❌ ${task.followUpNumber} → HubSpot ID ${task.hubspotTaskId} NOT FOUND in HubSpot`);
        } else if (error.response?.status === 401) {
          logError(`❌ ${task.followUpNumber} → Authentication failed - check HubSpot token`);
          break; // Don't continue if auth fails
        } else {
          logError(`❌ ${task.followUpNumber} → Error: ${error.response?.data?.message || error.message}`);
        }
      }
    }

    logInfo(`\n📊 Verification Summary:`);
    logSuccess(`✅ Verified in HubSpot: ${verifiedCount}/${syncedTasks.length}`);
    if (failedCount > 0) {
      logWarning(`❌ Failed/Not Found: ${failedCount}/${syncedTasks.length}`);
    }

    // Show all synced tasks summary
    logInfo(`\n📋 All Synced Tasks (latest ${syncedTasks.length}):`);
    syncedTasks.forEach((task, index) => {
      logInfo(`${index + 1}. ${task.followUpNumber} - ${task.customerName} → HubSpot: ${task.hubspotTaskId}`);
    });

  } catch (error) {
    logError(`Failed to verify HubSpot tasks: ${error.message}`);
  }
}

// Main test function
async function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('🚀 Task Creation & Functionality Test Script', 'blue');
  log('📦 Direct Database Access (No HTTP API)', 'blue');
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

    // Verify users
    log('-'.repeat(60), 'cyan');
    log('🔐 User Verification', 'cyan');
    log('-'.repeat(60), 'cyan');

    const adminUser = await verifyUser(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!adminUser) {
      logError('Failed to verify admin user');
      logInfo('Please check credentials or create admin user');
      process.exit(1);
    }
    logSuccess(`Admin verified: ${adminUser.name} (${adminUser.email})`);

    const salesmanUser = await verifyUser(SALESMAN_EMAIL, SALESMAN_PASSWORD);
    if (!salesmanUser) {
      logError('Failed to verify salesman user');
      logInfo('Please check credentials or create salesman user');
      process.exit(1);
    }
    logSuccess(`Salesman verified: ${salesmanUser.name} (${salesmanUser.email})`);

    // Store created task IDs for cleanup
    const createdTaskIds = [];

    // ===== TASK CREATION TESTS =====
    log('\n' + '='.repeat(60), 'blue');
    log('📝 TASK CREATION TESTS', 'blue');
    log('='.repeat(60), 'blue');

    // Test 1: Admin creates task
    const adminTask = await testAdminTaskCreation(adminUser, salesmanUser._id);
    if (adminTask) {
      createdTaskIds.push(adminTask._id);
    }

    // Test 2: Salesman creates task
    const salesmanTask = await testSalesmanTaskCreation(salesmanUser);
    if (salesmanTask) {
      createdTaskIds.push(salesmanTask._id);
    }

    // ===== TASK RETRIEVAL TESTS =====
    log('\n' + '='.repeat(60), 'blue');
    log('📖 TASK RETRIEVAL TESTS', 'blue');
    log('='.repeat(60), 'blue');

    // Test 3: Get all tasks
    await testGetAllTasks();

    // Test 4: Get tasks by salesman
    await testGetTasksBySalesman(salesmanUser._id);

    // Test 5: Get single task
    if (adminTask) {
      await testGetSingleTask(adminTask._id);
    }

    // ===== TASK UPDATE TESTS =====
    log('\n' + '='.repeat(60), 'blue');
    log('✏️  TASK UPDATE TESTS', 'blue');
    log('='.repeat(60), 'blue');

    // Test 6: Update task
    if (adminTask) {
      await testUpdateTask(adminTask._id, adminUser);
    }

    // Test 7: Update task (salesman)
    if (salesmanTask) {
      await testUpdateTaskStatus(salesmanTask._id, salesmanUser);
    }

    // ===== TASK APPROVAL TESTS =====
    log('\n' + '='.repeat(60), 'blue');
    log('✅ TASK APPROVAL TESTS', 'blue');
    log('='.repeat(60), 'blue');

    // Test 8: Approve task
    if (salesmanTask) {
      await testApproveTask(salesmanTask._id, adminUser);
    }

    // Create another salesman task for rejection test
    const salesmanTask2 = await testSalesmanTaskCreation(salesmanUser);
    if (salesmanTask2) {
      createdTaskIds.push(salesmanTask2._id);
      
      // Test 9: Reject task
      await testRejectTask(salesmanTask2._id, adminUser);
    }

    // ===== TASK COMPLETION TEST =====
    log('\n' + '='.repeat(60), 'blue');
    log('🏁 TASK COMPLETION TEST', 'blue');
    log('='.repeat(60), 'blue');

    // Test 10: Complete task (needs approval first)
    if (salesmanTask && salesmanTask.approvalStatus === 'Approved') {
      await testCompleteTask(salesmanTask._id, salesmanUser);
    } else {
      logWarning('Skipping completion test - task needs approval first');
    }

    // ===== TASK STATISTICS TEST =====
    log('\n' + '='.repeat(60), 'blue');
    log('📊 TASK STATISTICS TEST', 'blue');
    log('='.repeat(60), 'blue');

    // Test 11: Get task statistics
    await testTaskStatistics();

    // ===== TASK FILTERING TEST =====
    log('\n' + '='.repeat(60), 'blue');
    log('🔍 TASK FILTERING TEST', 'blue');
    log('='.repeat(60), 'blue');

    // Test 12: Task filtering
    await testTaskFiltering();

    // ===== HUBSPOT VERIFICATION =====
    log('\n' + '='.repeat(60), 'blue');
    log('🔍 HUBSPOT VERIFICATION', 'blue');
    log('='.repeat(60), 'blue');

    // Wait a bit for async HubSpot syncs to complete
    logInfo('Waiting 3 seconds for HubSpot syncs to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 13: Verify HubSpot tasks
    await verifyHubSpotTasks();

    // ===== CLEANUP (Optional) =====
    log('\n' + '='.repeat(60), 'blue');
    log('🧹 CLEANUP', 'blue');
    log('='.repeat(60), 'blue');
    logInfo('Created task IDs (for manual cleanup if needed):');
    createdTaskIds.forEach((id, index) => {
      logInfo(`${index + 1}. ${id}`);
    });
    logWarning('Tasks are NOT automatically deleted. Delete manually if needed.');

    // Summary
    log('\n' + '='.repeat(60), 'green');
    log('✅ ALL TESTS COMPLETED', 'green');
    log('='.repeat(60) + '\n', 'green');

    // Close database connection
    await mongoose.connection.close();
    logInfo('Database connection closed');
    process.exit(0);

  } catch (error) {
    logError(`Test failed with error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
