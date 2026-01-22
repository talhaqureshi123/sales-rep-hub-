/**
 * Comprehensive API Endpoint Test Script
 * Tests all admin and salesman endpoints
 * 
 * Usage:
 *   node backend/scripts/test-all-endpoints.js
 * 
 * With credentials (recommended):
 *   node backend/scripts/test-all-endpoints.js \
 *     --admin-email="admin@example.com" \
 *     --admin-password="admin123" \
 *     --salesman-email="salesman@example.com" \
 *     --salesman-password="salesman123"
 * 
 * Via environment variables:
 *   export ADMIN_EMAIL="admin@example.com"
 *   export ADMIN_PASSWORD="admin123"
 *   export SALESMAN_EMAIL="salesman@example.com"
 *   export SALESMAN_PASSWORD="salesman123"
 *   node backend/scripts/test-all-endpoints.js
 * 
 * Custom API base URL:
 *   node backend/scripts/test-all-endpoints.js --api-base-url="http://localhost:5000"
 */

const axios = require('axios');
const mongoose = require('mongoose');
const config = require('../config');

const BASE_URL = `http://localhost:${config.PORT || 4000}`;
const API_BASE = `${BASE_URL}/api`;

// Test credentials (update these with actual test credentials)
const ADMIN_EMAIL = 'talhaabid00321@gmail.com'; // Update with actual admin email
const ADMIN_PASSWORD = 'your-admin-password'; // Update with actual admin password
const SALESMAN_EMAIL = 'usman.abid00321@gmail.com'; // Update with actual salesman email
const SALESMAN_PASSWORD = 'your-salesman-password'; // Update with actual salesman password

let adminToken = '';
let salesmanToken = '';
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper function to make API requests
async function makeRequest(method, url, token, data = null, params = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      ...(data && { data }),
      ...(params && { params })
    };
    
    const response = await axios(config);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 500,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    };
  }
}

// Test function
async function testEndpoint(name, method, url, token, data = null, params = null, expectedStatus = 200) {
  process.stdout.write(`Testing ${name}... `);
  
  const result = await makeRequest(method, url, token, data, params);
  
  if (result.success && result.status === expectedStatus) {
    console.log(`${colors.green}✓ PASSED${colors.reset}`);
    testResults.passed++;
    return { success: true, data: result.data };
  } else if (result.status === 401 || result.status === 403) {
    console.log(`${colors.yellow}⚠ SKIPPED (Auth required)${colors.reset}`);
    testResults.skipped++;
    return { success: false, skipped: true };
  } else {
    console.log(`${colors.red}✗ FAILED${colors.reset} (Status: ${result.status}, Message: ${result.message || 'Unknown error'})`);
    testResults.failed++;
    testResults.errors.push({ name, url, status: result.status, message: result.message });
    return { success: false, error: result.message };
  }
}

// Authentication Tests
async function testAuthentication() {
  console.log(`\n${colors.cyan}=== AUTHENTICATION TESTS ===${colors.reset}\n`);
  
  // Admin Login
  const adminLogin = await makeRequest('POST', '/auth/login', null, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  
  if (adminLogin.success && adminLogin.data?.token) {
    adminToken = adminLogin.data.token;
    console.log(`${colors.green}✓ Admin login successful${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Admin login failed: ${adminLogin.message}${colors.reset}`);
    console.log(`${colors.yellow}⚠ Continuing with empty admin token - some tests will be skipped${colors.reset}`);
  }
  
  // Salesman Login
  const salesmanLogin = await makeRequest('POST', '/auth/login', null, {
    email: SALESMAN_EMAIL,
    password: SALESMAN_PASSWORD
  });
  
  if (salesmanLogin.success && salesmanLogin.data?.token) {
    salesmanToken = salesmanLogin.data.token;
    console.log(`${colors.green}✓ Salesman login successful${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Salesman login failed: ${salesmanLogin.message}${colors.reset}`);
    console.log(`${colors.yellow}⚠ Continuing with empty salesman token - some tests will be skipped${colors.reset}`);
  }
  
  // Get Me (Admin)
  await testEndpoint('Get Admin Profile', 'GET', '/auth/me', adminToken);
  
  // Get Me (Salesman)
  await testEndpoint('Get Salesman Profile', 'GET', '/auth/me', salesmanToken);
}

// Admin Endpoint Tests
async function testAdminEndpoints() {
  console.log(`\n${colors.cyan}=== ADMIN ENDPOINTS TESTS ===${colors.reset}\n`);
  
  // Users
  console.log(`\n${colors.blue}--- Users ---${colors.reset}`);
  await testEndpoint('Get All Users', 'GET', '/admin/users', adminToken);
  await testEndpoint('Create User', 'POST', '/admin/users', adminToken, {
    name: 'Test User',
    email: `test${Date.now()}@test.com`,
    password: 'Test123!',
    role: 'salesman'
  });
  
  // Products
  console.log(`\n${colors.blue}--- Products ---${colors.reset}`);
  await testEndpoint('Get All Products', 'GET', '/admin/products', adminToken);
  await testEndpoint('Create Product', 'POST', '/admin/products', adminToken, {
    name: 'Test Product',
    description: 'Test Description',
    price: 100
  });
  
  // Customers
  console.log(`\n${colors.blue}--- Customers ---${colors.reset}`);
  await testEndpoint('Get All Customers', 'GET', '/admin/customers', adminToken);
  const customerResult = await testEndpoint('Create Customer', 'POST', '/admin/customers', adminToken, {
    name: 'Test Customer',
    email: `customer${Date.now()}@test.com`,
    phone: '1234567890'
  });
  
  let customerId = null;
  if (customerResult.success && customerResult.data?.data?._id) {
    customerId = customerResult.data.data._id;
    await testEndpoint('Get Customer by ID', 'GET', `/admin/customers/${customerId}`, adminToken);
    await testEndpoint('Get Customer Details', 'GET', `/admin/customers/${customerId}/details`, adminToken);
    await testEndpoint('Update Customer', 'PUT', `/admin/customers/${customerId}`, adminToken, {
      name: 'Updated Customer'
    });
  }
  
  // Visit Targets
  console.log(`\n${colors.blue}--- Visit Targets ---${colors.reset}`);
  await testEndpoint('Get All Visit Targets', 'GET', '/admin/visit-targets', adminToken);
  const visitTargetResult = await testEndpoint('Create Visit Target', 'POST', '/admin/visit-targets', adminToken, {
    customerName: 'Test Customer',
    visitDate: new Date().toISOString(),
    status: 'Pending'
  });
  
  let visitTargetId = null;
  if (visitTargetResult.success && visitTargetResult.data?.data?._id) {
    visitTargetId = visitTargetResult.data.data._id;
    await testEndpoint('Get Visit Target by ID', 'GET', `/admin/visit-targets/${visitTargetId}`, adminToken);
  }
  
  // Quotations
  console.log(`\n${colors.blue}--- Quotations ---${colors.reset}`);
  await testEndpoint('Get All Quotations', 'GET', '/admin/quotations', adminToken);
  const quotationResult = await testEndpoint('Create Quotation', 'POST', '/admin/quotations', adminToken, {
    customerName: 'Test Customer',
    items: [{ product: 'Test Product', quantity: 1, price: 100 }]
  });
  
  let quotationId = null;
  if (quotationResult.success && quotationResult.data?.data?._id) {
    quotationId = quotationResult.data.data._id;
    await testEndpoint('Get Quotation by ID', 'GET', `/admin/quotations/${quotationId}`, adminToken);
  }
  
  // Samples
  console.log(`\n${colors.blue}--- Samples ---${colors.reset}`);
  await testEndpoint('Get All Samples', 'GET', '/admin/samples', adminToken);
  const sampleResult = await testEndpoint('Create Sample', 'POST', '/admin/samples', adminToken, {
    customerName: 'Test Customer',
    productName: 'Test Product',
    status: 'Pending'
  });
  
  let sampleId = null;
  if (sampleResult.success && sampleResult.data?.data?._id) {
    sampleId = sampleResult.data.data._id;
    await testEndpoint('Get Sample by ID', 'GET', `/admin/samples/${sampleId}`, adminToken);
  }
  
  // Follow-ups (Tasks)
  console.log(`\n${colors.blue}--- Follow-ups (Tasks) ---${colors.reset}`);
  await testEndpoint('Get Follow-up Stats', 'GET', '/admin/follow-ups/stats', adminToken);
  await testEndpoint('Get All Follow-ups', 'GET', '/admin/follow-ups', adminToken);
  const followUpResult = await testEndpoint('Create Follow-up', 'POST', '/admin/follow-ups', adminToken, {
    customerName: 'Test Customer',
    type: 'Call',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    description: 'Test Follow-up'
  });
  
  let followUpId = null;
  if (followUpResult.success && followUpResult.data?.data?._id) {
    followUpId = followUpResult.data.data._id;
    await testEndpoint('Get Follow-up by ID', 'GET', `/admin/follow-ups/${followUpId}`, adminToken);
    await testEndpoint('Update Follow-up', 'PUT', `/admin/follow-ups/${followUpId}`, adminToken, {
      description: 'Updated Follow-up'
    });
    await testEndpoint('Approve Follow-up', 'PUT', `/admin/follow-ups/${followUpId}/approve`, adminToken);
  }
  
  // Product Videos
  console.log(`\n${colors.blue}--- Product Videos ---${colors.reset}`);
  await testEndpoint('Get All Product Videos', 'GET', '/admin/product-videos', adminToken);
  
  // Sales Orders
  console.log(`\n${colors.blue}--- Sales Orders ---${colors.reset}`);
  await testEndpoint('Get All Sales Orders', 'GET', '/admin/sales-orders', adminToken);
  const salesOrderResult = await testEndpoint('Create Sales Order', 'POST', '/admin/sales-orders', adminToken, {
    customerName: 'Test Customer',
    items: [{ product: 'Test Product', quantity: 1, price: 100 }],
    orderDate: new Date().toISOString()
  });
  
  let salesOrderId = null;
  if (salesOrderResult.success && salesOrderResult.data?.data?._id) {
    salesOrderId = salesOrderResult.data.data._id;
    await testEndpoint('Get Sales Order by ID', 'GET', `/admin/sales-orders/${salesOrderId}`, adminToken);
  }
  
  // Sales Targets
  console.log(`\n${colors.blue}--- Sales Targets ---${colors.reset}`);
  await testEndpoint('Get All Sales Targets', 'GET', '/admin/sales-targets', adminToken);
  
  // Sales Submissions
  console.log(`\n${colors.blue}--- Sales Submissions ---${colors.reset}`);
  await testEndpoint('Get All Sales Submissions', 'GET', '/admin/sales-submissions', adminToken);
  
  // Shift Photos
  console.log(`\n${colors.blue}--- Shift Photos ---${colors.reset}`);
  await testEndpoint('Get All Shift Photos', 'GET', '/admin/shift-photos', adminToken);
  
  // Tracking
  console.log(`\n${colors.blue}--- Tracking ---${colors.reset}`);
  await testEndpoint('Get All Tracking Data', 'GET', '/admin/tracking', adminToken);
  
  // Locations
  console.log(`\n${colors.blue}--- Locations ---${colors.reset}`);
  await testEndpoint('Get All Locations', 'GET', '/admin/locations', adminToken);
  
  // HubSpot
  console.log(`\n${colors.blue}--- HubSpot ---${colors.reset}`);
  await testEndpoint('Test HubSpot Connection', 'GET', '/admin/hubspot/test', adminToken);
  await testEndpoint('Get HubSpot Customers', 'GET', '/admin/hubspot/customers', adminToken);
  await testEndpoint('Get HubSpot Orders', 'GET', '/admin/hubspot/orders', adminToken);
  await testEndpoint('Get HubSpot Orders Required Fields', 'GET', '/admin/hubspot/orders-required', adminToken);
}

// Salesman Endpoint Tests
async function testSalesmanEndpoints() {
  console.log(`\n${colors.cyan}=== SALESMAN ENDPOINTS TESTS ===${colors.reset}\n`);
  
  // Products
  console.log(`\n${colors.blue}--- Products ---${colors.reset}`);
  await testEndpoint('Get All Products', 'GET', '/salesman/products', salesmanToken);
  
  // Customers
  console.log(`\n${colors.blue}--- Customers ---${colors.reset}`);
  await testEndpoint('Get My Customers', 'GET', '/salesman/customers', salesmanToken);
  const customerResult = await testEndpoint('Create Customer', 'POST', '/salesman/customers', salesmanToken, {
    name: 'Test Customer',
    email: `customer${Date.now()}@test.com`,
    phone: '1234567890'
  });
  
  let customerId = null;
  if (customerResult.success && customerResult.data?.data?._id) {
    customerId = customerResult.data.data._id;
    await testEndpoint('Get Customer by ID', 'GET', `/salesman/customers/${customerId}`, salesmanToken);
  }
  
  // Quotations
  console.log(`\n${colors.blue}--- Quotations ---${colors.reset}`);
  await testEndpoint('Get My Quotations', 'GET', '/salesman/quotations', salesmanToken);
  const quotationResult = await testEndpoint('Create Quotation', 'POST', '/salesman/quotations', salesmanToken, {
    customerName: 'Test Customer',
    items: [{ product: 'Test Product', quantity: 1, price: 100 }]
  });
  
  let quotationId = null;
  if (quotationResult.success && quotationResult.data?.data?._id) {
    quotationId = quotationResult.data.data._id;
    await testEndpoint('Get Quotation by ID', 'GET', `/salesman/quotations/${quotationId}`, salesmanToken);
  }
  
  // Visit Targets
  console.log(`\n${colors.blue}--- Visit Targets ---${colors.reset}`);
  await testEndpoint('Get My Visit Targets', 'GET', '/salesman/visit-targets', salesmanToken);
  const visitTargetResult = await testEndpoint('Create Visit Target', 'POST', '/salesman/visit-targets', salesmanToken, {
    customerName: 'Test Customer',
    visitDate: new Date().toISOString(),
    status: 'Pending'
  });
  
  let visitTargetId = null;
  if (visitTargetResult.success && visitTargetResult.data?.data?._id) {
    visitTargetId = visitTargetResult.data.data._id;
    await testEndpoint('Get Visit Target by ID', 'GET', `/salesman/visit-targets/${visitTargetId}`, salesmanToken);
  }
  
  // Achievements
  console.log(`\n${colors.blue}--- Achievements ---${colors.reset}`);
  await testEndpoint('Get My Achievements', 'GET', '/salesman/achievements', salesmanToken);
  
  // Dashboard
  console.log(`\n${colors.blue}--- Dashboard ---${colors.reset}`);
  await testEndpoint('Get Dashboard Data', 'GET', '/salesman/dashboard', salesmanToken);
  
  // Location
  console.log(`\n${colors.blue}--- Location ---${colors.reset}`);
  await testEndpoint('Get My Locations', 'GET', '/salesman/location', salesmanToken);
  await testEndpoint('Create Location', 'POST', '/salesman/location', salesmanToken, {
    latitude: 24.8607,
    longitude: 67.0011,
    address: 'Test Location'
  });
  
  // Tracking
  console.log(`\n${colors.blue}--- Tracking ---${colors.reset}`);
  await testEndpoint('Get My Tracking Data', 'GET', '/salesman/tracking', salesmanToken);
  await testEndpoint('Create Tracking', 'POST', '/salesman/tracking', salesmanToken, {
    latitude: 24.8607,
    longitude: 67.0011,
    address: 'Test Location'
  });
  
  // Samples
  console.log(`\n${colors.blue}--- Samples ---${colors.reset}`);
  await testEndpoint('Get My Samples', 'GET', '/salesman/samples', salesmanToken);
  const sampleResult = await testEndpoint('Create Sample', 'POST', '/salesman/samples', salesmanToken, {
    customerName: 'Test Customer',
    productName: 'Test Product',
    status: 'Pending'
  });
  
  let sampleId = null;
  if (sampleResult.success && sampleResult.data?.data?._id) {
    sampleId = sampleResult.data.data._id;
    await testEndpoint('Get Sample by ID', 'GET', `/salesman/samples/${sampleId}`, salesmanToken);
  }
  
  // Follow-ups (Tasks)
  console.log(`\n${colors.blue}--- Follow-ups (Tasks) ---${colors.reset}`);
  await testEndpoint('Get My Follow-ups', 'GET', '/salesman/follow-ups', salesmanToken);
  const followUpResult = await testEndpoint('Create Follow-up', 'POST', '/salesman/follow-ups', salesmanToken, {
    customerName: 'Test Customer',
    type: 'Call',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    description: 'Test Follow-up'
  });
  
  let followUpId = null;
  if (followUpResult.success && followUpResult.data?.data?._id) {
    followUpId = followUpResult.data.data._id;
    await testEndpoint('Get Follow-up by ID', 'GET', `/salesman/follow-ups/${followUpId}`, salesmanToken);
    await testEndpoint('Update Follow-up', 'PUT', `/salesman/follow-ups/${followUpId}`, salesmanToken, {
      description: 'Updated Follow-up'
    });
  }
  
  // Sales Targets
  console.log(`\n${colors.blue}--- Sales Targets ---${colors.reset}`);
  await testEndpoint('Get My Sales Targets', 'GET', '/salesman/sales-targets', salesmanToken);
  
  // Sales Submissions
  console.log(`\n${colors.blue}--- Sales Submissions ---${colors.reset}`);
  await testEndpoint('Get My Sales Submissions', 'GET', '/salesman/sales-submissions', salesmanToken);
}

// Main test runner
async function runTests() {
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║     COMPREHENSIVE API ENDPOINT TEST SUITE                 ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`Admin Email: ${ADMIN_EMAIL}`);
  console.log(`Salesman Email: ${SALESMAN_EMAIL}\n`);
  
  if (ADMIN_PASSWORD === 'your-admin-password' || SALESMAN_PASSWORD === 'your-salesman-password') {
    console.log(`${colors.yellow}⚠ WARNING: Using default passwords. Please provide credentials via:`);
    console.log(`   CLI: --admin-email="..." --admin-password="..." --salesman-email="..." --salesman-password="..."`);
    console.log(`   ENV: ADMIN_EMAIL, ADMIN_PASSWORD, SALESMAN_EMAIL, SALESMAN_PASSWORD${colors.reset}\n`);
  }
  
  // Test health check first
  console.log(`${colors.cyan}=== HEALTH CHECK ===${colors.reset}\n`);
  const healthCheck = await makeRequest('GET', '/health', null);
  if (healthCheck.success) {
    console.log(`${colors.green}✓ Server is running${colors.reset}\n`);
  } else {
    console.log(`${colors.red}✗ Server health check failed${colors.reset}\n`);
    console.log(`${colors.red}Please make sure the server is running on port ${config.PORT || 4000}${colors.reset}\n`);
    process.exit(1);
  }
  
  // Run authentication tests
  await testAuthentication();
  
  // Run admin endpoint tests
  if (adminToken) {
    await testAdminEndpoints();
  } else {
    console.log(`\n${colors.yellow}⚠ Skipping admin endpoint tests - admin token not available${colors.reset}`);
  }
  
  // Run salesman endpoint tests
  if (salesmanToken) {
    await testSalesmanEndpoints();
  } else {
    console.log(`\n${colors.yellow}⚠ Skipping salesman endpoint tests - salesman token not available${colors.reset}`);
  }
  
  // Print summary
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                    TEST SUMMARY                            ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${testResults.skipped}${colors.reset}`);
  console.log(`Total: ${testResults.passed + testResults.failed + testResults.skipped}\n`);
  
  if (testResults.errors.length > 0) {
    console.log(`${colors.red}Failed Tests:${colors.reset}`);
    testResults.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.name} (${error.url})`);
      console.log(`     Status: ${error.status}, Message: ${error.message || 'Unknown error'}`);
    });
  }
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`${colors.red}Test runner error:${colors.reset}`, error);
  process.exit(1);
});
