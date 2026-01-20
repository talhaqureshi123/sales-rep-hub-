/**
 * Comprehensive API Test Script
 * 
 * Tests ALL Admin and Salesman APIs including HubSpot integration
 * 
 * Usage:
 *   node scripts/comprehensiveApiTest.js
 * 
 * This script tests:
 *   - Admin Authentication
 *   - Salesman Authentication
 *   - Admin Follow-Up APIs (Tasks)
 *   - Salesman Follow-Up APIs (Tasks)
 *   - HubSpot Integration APIs
 *   - All CRUD operations
 *   - All filtering and search
 */

const axios = require('axios');
const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const config = require('../config');

// API Base URL - Try to detect port from environment or use default
// Check if PORT is set in environment, otherwise try common ports
// Server seems to be running on 4000 based on error, so try that first
const PORT = process.env.PORT || config.PORT || 4000;
// Use 127.0.0.1 instead of localhost to avoid IPv6 issues
const API_BASE_URL = `http://127.0.0.1:${PORT}/api`;

console.log(`\n🔍 Backend API Test Configuration:`);
console.log(`   API Base URL: ${API_BASE_URL}`);
console.log(`   Backend Server: http://127.0.0.1:${PORT}`);
console.log(`   Port Source: ${process.env.PORT ? 'environment (.env)' : config.PORT ? 'config.js' : 'default'}\n`);

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

// Store tokens and IDs
let adminToken = null;
let salesmanToken = null;
let adminUserId = null;
let salesmanUserId = null;
let createdTaskId = null;
let createdSalesmanTaskId = null;

// ============================================
// AUTHENTICATION TESTS
// ============================================

async function testAdminLogin() {
  logSection('ADMIN AUTHENTICATION');
  
  try {
    logInfo(`Attempting login for: ${ADMIN_EMAIL}`);
    logInfo(`API URL: ${API_BASE_URL}/auth/login`);
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }, {
      timeout: 5000,
      validateStatus: function (status) {
        return status < 500; // Don't throw for 4xx errors
      }
    });

    logInfo(`Response status: ${response.status}`);
    logInfo(`Response data: ${JSON.stringify(response.data).substring(0, 200)}`);

    if (response.data.success && response.data.data?.token) {
      adminToken = response.data.data.token;
      adminUserId = response.data.data.user?._id || response.data.data.user?.id;
      logSuccess(`Admin login successful - Token: ${adminToken.substring(0, 20)}...`);
      logInfo(`Admin User ID: ${adminUserId}`);
      logInfo(`Admin Role: ${response.data.data.user?.role || 'N/A'}`);
      return true;
    } else {
      logError('Admin login failed - No token received');
      if (response.data.message) {
        logError(`Error message: ${response.data.message}`);
      }
      logError(`Full response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logError(`Admin login failed - Server not running on port ${PORT}`);
      logError(`Error: ${error.message}`);
      logInfo('Please start the backend server first: npm start');
    } else if (error.response) {
      logError(`Admin login failed - Status: ${error.response.status}`);
      logError(`Error: ${error.response.data?.message || JSON.stringify(error.response.data)}`);
    } else {
      logError(`Admin login failed - ${error.message}`);
    }
    return false;
  }
}

async function testSalesmanLogin() {
  logSection('SALESMAN AUTHENTICATION');
  
  try {
    logInfo(`Attempting login for: ${SALESMAN_EMAIL}`);
    logInfo(`API URL: ${API_BASE_URL}/auth/login`);
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: SALESMAN_EMAIL,
      password: SALESMAN_PASSWORD
    }, {
      timeout: 5000,
      validateStatus: function (status) {
        return status < 500; // Don't throw for 4xx errors
      }
    });

    logInfo(`Response status: ${response.status}`);
    logInfo(`Response data: ${JSON.stringify(response.data).substring(0, 200)}`);

    if (response.data.success && response.data.data?.token) {
      salesmanToken = response.data.data.token;
      salesmanUserId = response.data.data.user?._id || response.data.data.user?.id;
      logSuccess(`Salesman login successful - Token: ${salesmanToken.substring(0, 20)}...`);
      logInfo(`Salesman User ID: ${salesmanUserId}`);
      logInfo(`Salesman Role: ${response.data.data.user?.role || 'N/A'}`);
      return true;
    } else {
      logError('Salesman login failed - No token received');
      if (response.data.message) {
        logError(`Error message: ${response.data.message}`);
      }
      logError(`Full response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logError(`Salesman login failed - Server not running on port ${PORT}`);
      logError(`Error: ${error.message}`);
      logInfo('Please start the backend server first: npm start');
    } else if (error.response) {
      logError(`Salesman login failed - Status: ${error.response.status}`);
      logError(`Error: ${error.response.data?.message || JSON.stringify(error.response.data)}`);
    } else {
      logError(`Salesman login failed - ${error.message}`);
    }
    return false;
  }
}

// ============================================
// ADMIN FOLLOW-UP (TASKS) API TESTS
// ============================================

async function testAdminGetAllTasks() {
  logSection('ADMIN: Get All Tasks');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/follow-ups`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const tasks = response.data.data || [];
      logSuccess(`Get all tasks - Found ${tasks.length} tasks`);
      return true;
    } else {
      logError('Get all tasks failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Get all tasks failed', error.response?.data || error);
    return false;
  }
}

async function testAdminGetTasksWithFilters() {
  logSection('ADMIN: Get Tasks with Filters');
  
  const filters = [
    { status: 'Pending' },
    { status: 'Overdue' },
    { status: 'Today' },
    { priority: 'High' },
    { type: 'Call' },
    { approvalStatus: 'Pending' },
    { approvalStatus: 'Approved' }
  ];

  for (const filter of filters) {
    try {
      const params = new URLSearchParams(filter);
      const response = await axios.get(`${API_BASE_URL}/admin/follow-ups?${params}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      if (response.data.success) {
        const tasks = response.data.data || [];
        logSuccess(`Filter: ${JSON.stringify(filter)} - Found ${tasks.length} tasks`);
      } else {
        logError(`Filter failed: ${JSON.stringify(filter)}`, response.data);
      }
    } catch (error) {
      logError(`Filter error: ${JSON.stringify(filter)}`, error.response?.data || error);
    }
  }
}

async function testAdminCreateTask() {
  logSection('ADMIN: Create Task');
  
  try {
    const taskData = {
      salesman: salesmanUserId,
      customerName: 'Test Customer API',
      customerEmail: 'test@example.com',
      customerPhone: '1234567890',
      type: 'Call',
      priority: 'High',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      description: 'Test task created via API',
      notes: 'This is a test task'
    };

    const response = await axios.post(`${API_BASE_URL}/admin/follow-ups`, taskData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success && response.data.data) {
      createdTaskId = response.data.data._id;
      logSuccess(`Task created - ID: ${createdTaskId}`);
      logInfo(`Task Number: ${response.data.data.followUpNumber}`);
      logInfo(`Approval Status: ${response.data.data.approvalStatus}`);
      logInfo(`HubSpot Task ID: ${response.data.data.hubspotTaskId || 'Not synced yet'}`);
      return true;
    } else {
      logError('Task creation failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Task creation failed', error.response?.data || error);
    return false;
  }
}

async function testAdminGetTaskById() {
  if (!createdTaskId) {
    logWarning('Skipping - No task ID available');
    return false;
  }

  logSection('ADMIN: Get Task by ID');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/follow-ups/${createdTaskId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      logSuccess(`Task retrieved - ID: ${createdTaskId}`);
      logInfo(`Task: ${response.data.data.followUpNumber} - ${response.data.data.description}`);
      return true;
    } else {
      logError('Get task by ID failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Get task by ID failed', error.response?.data || error);
    return false;
  }
}

async function testAdminUpdateTask() {
  if (!createdTaskId) {
    logWarning('Skipping - No task ID available');
    return false;
  }

  logSection('ADMIN: Update Task');
  
  try {
    const updateData = {
      description: 'Updated task description via API',
      priority: 'Urgent',
      notes: 'Updated notes'
    };

    const response = await axios.put(`${API_BASE_URL}/admin/follow-ups/${createdTaskId}`, updateData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      logSuccess(`Task updated - ID: ${createdTaskId}`);
      return true;
    } else {
      logError('Task update failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Task update failed', error.response?.data || error);
    return false;
  }
}

async function testAdminGetTaskStats() {
  logSection('ADMIN: Get Task Statistics');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/follow-ups/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const stats = response.data.data || {};
      logSuccess('Task statistics retrieved');
      logInfo(`Total: ${stats.total || 0}`);
      logInfo(`Pending: ${stats.pending || 0}`);
      logInfo(`Approved: ${stats.approved || 0}`);
      logInfo(`Overdue: ${stats.overdue || 0}`);
      return true;
    } else {
      logError('Get task stats failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Get task stats failed', error.response?.data || error);
    return false;
  }
}

// ============================================
// SALESMAN FOLLOW-UP (TASKS) API TESTS
// ============================================

async function testSalesmanGetAllTasks() {
  logSection('SALESMAN: Get All My Tasks');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/salesman/follow-ups`, {
      headers: { Authorization: `Bearer ${salesmanToken}` }
    });

    if (response.data.success) {
      const tasks = response.data.data || [];
      logSuccess(`Get all my tasks - Found ${tasks.length} tasks`);
      return true;
    } else {
      logError('Get all my tasks failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Get all my tasks failed', error.response?.data || error);
    return false;
  }
}

async function testSalesmanCreateTask() {
  logSection('SALESMAN: Create Task');
  
  try {
    const taskData = {
      customerName: 'Test Customer Salesman',
      customerEmail: 'salesman@example.com',
      customerPhone: '9876543210',
      type: 'Visit',
      priority: 'Medium',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      description: 'Test task created by salesman via API',
      notes: 'This task needs admin approval'
    };

    const response = await axios.post(`${API_BASE_URL}/salesman/follow-ups`, taskData, {
      headers: { Authorization: `Bearer ${salesmanToken}` }
    });

    if (response.data.success && response.data.data) {
      createdSalesmanTaskId = response.data.data._id;
      logSuccess(`Task created - ID: ${createdSalesmanTaskId}`);
      logInfo(`Task Number: ${response.data.data.followUpNumber}`);
      logInfo(`Approval Status: ${response.data.data.approvalStatus}`);
      logInfo(`HubSpot Task ID: ${response.data.data.hubspotTaskId || 'Not synced (pending approval)'}`);
      return true;
    } else {
      logError('Task creation failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Task creation failed', error.response?.data || error);
    return false;
  }
}

async function testSalesmanGetTaskById() {
  if (!createdSalesmanTaskId) {
    logWarning('Skipping - No salesman task ID available');
    return false;
  }

  logSection('SALESMAN: Get Task by ID');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/salesman/follow-ups/${createdSalesmanTaskId}`, {
      headers: { Authorization: `Bearer ${salesmanToken}` }
    });

    if (response.data.success) {
      logSuccess(`Task retrieved - ID: ${createdSalesmanTaskId}`);
      logInfo(`Task: ${response.data.data.followUpNumber} - ${response.data.data.description}`);
      return true;
    } else {
      logError('Get task by ID failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Get task by ID failed', error.response?.data || error);
    return false;
  }
}

async function testSalesmanUpdateTask() {
  if (!createdSalesmanTaskId) {
    logWarning('Skipping - No salesman task ID available');
    return false;
  }

  logSection('SALESMAN: Update Task');
  
  try {
    const updateData = {
      description: 'Updated task description by salesman',
      notes: 'Updated notes by salesman'
    };

    const response = await axios.put(`${API_BASE_URL}/salesman/follow-ups/${createdSalesmanTaskId}`, updateData, {
      headers: { Authorization: `Bearer ${salesmanToken}` }
    });

    if (response.data.success) {
      logSuccess(`Task updated - ID: ${createdSalesmanTaskId}`);
      return true;
    } else {
      logError('Task update failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Task update failed', error.response?.data || error);
    return false;
  }
}

// ============================================
// ADMIN TASK APPROVAL/REJECTION TESTS
// ============================================

async function testAdminApproveTask() {
  if (!createdSalesmanTaskId) {
    logWarning('Skipping - No salesman task ID available for approval');
    return false;
  }

  logSection('ADMIN: Approve Salesman Task');
  
  try {
    const response = await axios.put(`${API_BASE_URL}/admin/follow-ups/${createdSalesmanTaskId}/approve`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      logSuccess(`Task approved - ID: ${createdSalesmanTaskId}`);
      
      // Wait a bit for async HubSpot sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if HubSpot sync happened
      const checkResponse = await axios.get(`${API_BASE_URL}/admin/follow-ups/${createdSalesmanTaskId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (checkResponse.data.success && checkResponse.data.data.hubspotTaskId) {
        logInfo(`✅ Task synced to HubSpot: ${checkResponse.data.data.hubspotTaskId}`);
      } else {
        logWarning('⚠️  Task approved but HubSpot sync pending');
      }
      
      return true;
    } else {
      logError('Task approval failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Task approval failed', error.response?.data || error);
    return false;
  }
}

async function testAdminRejectTask() {
  logSection('ADMIN: Reject Task (Test)');
  
  // Create a task first to reject
  try {
    const taskData = {
      salesman: salesmanUserId,
      customerName: 'Task to Reject',
      type: 'Call',
      priority: 'Low',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'This task will be rejected'
    };

    const createResponse = await axios.post(`${API_BASE_URL}/admin/follow-ups`, taskData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (createResponse.data.success) {
      const taskId = createResponse.data.data._id;
      
      // Reject it
      const rejectResponse = await axios.put(`${API_BASE_URL}/admin/follow-ups/${taskId}/reject`, {
        rejectionReason: 'Test rejection via API'
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      if (rejectResponse.data.success) {
        logSuccess(`Task rejected - ID: ${taskId}`);
        return true;
      } else {
        logError('Task rejection failed', rejectResponse.data);
        return false;
      }
    }
  } catch (error) {
    logError('Task rejection test failed', error.response?.data || error);
    return false;
  }
}

async function testAdminPushTaskToHubSpot() {
  if (!createdTaskId) {
    logWarning('Skipping - No task ID available');
    return false;
  }

  logSection('ADMIN: Push Task to HubSpot');
  
  try {
    const response = await axios.put(`${API_BASE_URL}/admin/follow-ups/${createdTaskId}/push-to-hubspot`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      logSuccess(`Task pushed to HubSpot - ID: ${createdTaskId}`);
      logInfo(`HubSpot Task ID: ${response.data.data?.hubspotTaskId || 'N/A'}`);
      return true;
    } else {
      logWarning(`Push failed (may already be synced): ${response.data.message}`);
      return false;
    }
  } catch (error) {
    logWarning(`Push failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// ============================================
// HUBSPOT INTEGRATION API TESTS
// ============================================

async function testHubSpotConnection() {
  logSection('HUBSPOT: Test Connection');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/hubspot/test`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      logSuccess('HubSpot connection test successful');
      logInfo(`API Status: ${response.data.directApiTest?.success ? '✅ Working' : '❌ Failed'}`);
      return true;
    } else {
      logError('HubSpot connection test failed', response.data);
      return false;
    }
  } catch (error) {
    logError('HubSpot connection test failed', error.response?.data || error);
    return false;
  }
}

async function testHubSpotGetCustomers() {
  logSection('HUBSPOT: Get Customers');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/hubspot/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const customers = response.data.data || [];
      logSuccess(`HubSpot customers fetched - Found ${customers.length} customers`);
      return true;
    } else {
      logError('Get HubSpot customers failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Get HubSpot customers failed', error.response?.data || error);
    return false;
  }
}

async function testHubSpotGetOrders() {
  logSection('HUBSPOT: Get Orders');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/hubspot/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const orders = response.data.data || [];
      logSuccess(`HubSpot orders fetched - Found ${orders.length} orders`);
      return true;
    } else {
      logError('Get HubSpot orders failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Get HubSpot orders failed', error.response?.data || error);
    return false;
  }
}

async function testHubSpotImportCustomers() {
  logSection('HUBSPOT: Import Customers');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/admin/hubspot/import-customers`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const data = response.data.data || {};
      logSuccess('HubSpot customers imported');
      logInfo(`Fetched: ${data.fetchedFromHubSpot || 0}`);
      logInfo(`Created: ${data.created || 0}`);
      logInfo(`Updated: ${data.updated || 0}`);
      logInfo(`Skipped: ${data.skipped || 0}`);
      return true;
    } else {
      logError('Import HubSpot customers failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Import HubSpot customers failed', error.response?.data || error);
    return false;
  }
}

async function testHubSpotImportTasks() {
  logSection('HUBSPOT: Import Tasks');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/admin/hubspot/import-tasks`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const data = response.data.data || {};
      logSuccess('HubSpot tasks imported');
      logInfo(`Fetched: ${data.fetchedFromHubSpot || 0}`);
      logInfo(`Created: ${data.created || 0}`);
      logInfo(`Updated: ${data.updated || 0}`);
      logInfo(`Skipped: ${data.skipped || 0}`);
      return true;
    } else {
      logError('Import HubSpot tasks failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Import HubSpot tasks failed', error.response?.data || error);
    return false;
  }
}

async function testHubSpotPushCustomers() {
  logSection('HUBSPOT: Push Customers');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/admin/hubspot/push-customers`, {
      force: false,
      limit: 5
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const data = response.data.data || {};
      logSuccess('Customers pushed to HubSpot');
      logInfo(`Attempted: ${data.attempted || 0}`);
      logInfo(`Synced: ${data.synced || 0}`);
      logInfo(`Skipped: ${data.skipped || 0}`);
      logInfo(`Failed: ${data.failed || 0}`);
      return true;
    } else {
      logError('Push customers to HubSpot failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Push customers to HubSpot failed', error.response?.data || error);
    return false;
  }
}

async function testHubSpotPushTasks() {
  logSection('HUBSPOT: Push Tasks');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/admin/hubspot/push-tasks`, {
      force: false,
      limit: 5
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const data = response.data.data || {};
      logSuccess('Tasks pushed to HubSpot');
      logInfo(`Attempted: ${data.attempted || 0}`);
      logInfo(`Synced: ${data.synced || 0}`);
      logInfo(`Skipped: ${data.skipped || 0}`);
      logInfo(`Failed: ${data.failed || 0}`);
      return true;
    } else {
      logError('Push tasks to HubSpot failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Push tasks to HubSpot failed', error.response?.data || error);
    return false;
  }
}

async function testHubSpotPushOrders() {
  logSection('HUBSPOT: Push Orders');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/admin/hubspot/push-orders`, {
      force: false,
      limit: 5
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      const data = response.data.data || {};
      logSuccess('Orders pushed to HubSpot');
      logInfo(`Attempted: ${data.attempted || 0}`);
      logInfo(`Synced: ${data.synced || 0}`);
      logInfo(`Failed: ${data.failed || 0}`);
      return true;
    } else {
      logError('Push orders to HubSpot failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Push orders to HubSpot failed', error.response?.data || error);
    return false;
  }
}

async function testHubSpotCreateTask() {
  logSection('HUBSPOT: Create Task Directly');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/admin/hubspot/tasks`, {
      subject: 'Test Task Created via API',
      contactId: null
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (response.data.success) {
      logSuccess('Task created directly in HubSpot');
      logInfo(`HubSpot Task ID: ${response.data.data?.id || 'N/A'}`);
      return true;
    } else {
      logError('Create HubSpot task failed', response.data);
      return false;
    }
  } catch (error) {
    logError('Create HubSpot task failed', error.response?.data || error);
    return false;
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('🚀 COMPREHENSIVE API TEST SUITE', 'magenta');
  log('='.repeat(60) + '\n', 'blue');

  // Connect to database first
  try {
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected successfully\n');
  } catch (error) {
    logError('Database connection failed', error);
    logWarning('Continuing with API tests anyway...\n');
  }

  // Check if server is running
  logInfo(`Testing backend server on http://127.0.0.1:${PORT}...`);
  try {
    // Try to connect to the root endpoint or a simple endpoint
    const testUrl = `http://127.0.0.1:${PORT}/api/auth/login`;
    logInfo(`Testing connection to: ${testUrl}`);
    
    // Just check if server responds (even with error is fine, means server is running)
    await axios.post(testUrl, {}, { 
      timeout: 3000,
      validateStatus: () => true // Accept any status code
    });
    logSuccess(`Backend server is running on port ${PORT}`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logError(`❌ Backend server is NOT running on port ${PORT}`);
      logError(`Error: ${error.message}`);
      logError(`\n⚠️  Please start the backend server first:`);
      logError(`   cd backend`);
      logError(`   npm start`);
      logError(`\n   Or in development mode:`);
      logError(`   npm run dev`);
      process.exit(1);
    } else {
      logWarning(`Server health check failed - but continuing anyway`);
      logInfo(`Make sure backend server is running on port ${PORT}`);
    }
  }

  // Authentication
  const adminLoggedIn = await testAdminLogin();
  const salesmanLoggedIn = await testSalesmanLogin();

  if (!adminLoggedIn || !salesmanLoggedIn) {
    logError('Authentication failed - Cannot continue tests');
    printSummary();
    process.exit(1);
  }

  // Admin Follow-Up Tests
  await testAdminGetAllTasks();
  await testAdminGetTasksWithFilters();
  await testAdminCreateTask();
  await testAdminGetTaskById();
  await testAdminUpdateTask();
  await testAdminGetTaskStats();

  // Salesman Follow-Up Tests
  await testSalesmanGetAllTasks();
  await testSalesmanCreateTask();
  await testSalesmanGetTaskById();
  await testSalesmanUpdateTask();

  // Admin Approval/Rejection Tests
  await testAdminApproveTask();
  await testAdminRejectTask();
  await testAdminPushTaskToHubSpot();

  // HubSpot Integration Tests
  await testHubSpotConnection();
  await testHubSpotGetCustomers();
  await testHubSpotGetOrders();
  await testHubSpotImportCustomers();
  await testHubSpotImportTasks();
  await testHubSpotPushCustomers();
  await testHubSpotPushTasks();
  await testHubSpotPushOrders();
  await testHubSpotCreateTask();

  // Print Summary
  printSummary();

  // Close database connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    logInfo('Database connection closed');
  }
}

function printSummary() {
  log('\n' + '='.repeat(60), 'blue');
  log('📊 TEST SUMMARY', 'magenta');
  log('='.repeat(60), 'blue');
  
  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(2);
  
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
  // Close database connection
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close();
  }
  process.exit(1);
});
