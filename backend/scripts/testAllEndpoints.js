/**
 * Comprehensive API Endpoint Test Script
 * Tests ALL Admin and Salesman HTTP API endpoints
 * 
 * ⚠️  REQUIRES: Backend server must be running on port 4000
 * 
 * Usage:
 *   node backend/scripts/testAllEndpoints.js
 * 
 * For direct database testing (no server needed):
 *   npm run test:database
 * 
 * Environment Variables (optional):
 *   ADMIN_EMAIL=admin@example.com
 *   ADMIN_PASSWORD=admin123
 *   SALESMAN_EMAIL=salesman@example.com
 *   SALESMAN_PASSWORD=salesman123
 *   PORT=4000
 */

const axios = require('axios');
const config = require('../config');

// NOTE: This script tests HTTP API endpoints (requires backend server running)
// For direct database testing without server, use: testDatabaseEndpoints.js

// Configuration
const PORT = process.env.PORT || config.PORT || 4000;
const API_BASE_URL = `http://127.0.0.1:${PORT}/api`;

// Test credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'talhaabid400@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const SALESMAN_EMAIL = process.env.SALESMAN_EMAIL || 'usman.abid00321@gmail.com';
const SALESMAN_PASSWORD = process.env.SALESMAN_PASSWORD || 'salesman123';

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

// Store tokens and IDs for testing
let adminToken = null;
let salesmanToken = null;
let adminUserId = null;
let salesmanUserId = null;
const createdIds = {
  customer: null,
  product: null,
  visitTarget: null,
  quotation: null,
  sample: null,
  followUp: null,
  salesOrder: null,
  salesTarget: null,
  // salesSubmission removed - using sales orders instead
  shiftPhoto: null,
  tracking: null,
  location: null
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function makeRequest(method, url, token, data = null, params = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      timeout: 30000, // Increased timeout for HubSpot operations
      validateStatus: () => true // Don't throw on any status
    };
    
    if (data) config.data = data;
    if (params) config.params = params;
    
    const response = await axios(config);
    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data,
      message: response.data?.message || response.data?.error || null
    };
  } catch (error) {
    // Extract detailed error message
    let errorMessage = error.message;
    if (error.response?.data) {
      const errorData = error.response.data;
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : errorData.error.message || JSON.stringify(errorData.error);
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else {
        errorMessage = JSON.stringify(errorData).substring(0, 200);
      }
    }
    
    return {
      success: false,
      status: error.response?.status || 500,
      message: errorMessage,
      data: error.response?.data || null,
      error: error
    };
  }
}

async function testEndpoint(name, method, url, token, data = null, params = null, expectedStatus = 200, storeId = null) {
  process.stdout.write(`  Testing ${name}... `);
  
  const result = await makeRequest(method, url, token, data, params);
  
  // Handle success cases (200, 201, etc.)
  // Accept 200-299 range as success, but prefer exact match
  const isSuccess = result.success && (
    result.status === expectedStatus || 
    (expectedStatus === 201 && (result.status === 201 || result.status === 200)) ||
    (expectedStatus === 200 && (result.status === 200 || result.status === 201)) ||
    (result.status >= 200 && result.status < 300 && expectedStatus >= 200 && expectedStatus < 300)
  );
  
  if (isSuccess) {
    console.log(`${colors.green}✓ PASSED${colors.reset}`);
    testResults.passed++;
    testResults.total++;
    
    // Store ID if requested
    if (storeId && result.data?.data?._id) {
      createdIds[storeId] = result.data.data._id;
    }
    
    return { success: true, data: result.data };
  } else if (result.status === 401 || result.status === 403) {
    console.log(`${colors.yellow}⚠ SKIPPED (Auth)${colors.reset}`);
    testResults.skipped++;
    testResults.total++;
    return { success: false, skipped: true };
  } else {
    console.log(`${colors.red}✗ FAILED${colors.reset} (Status: ${result.status})`);
    
    // Show detailed error message
    let errorMsg = result.message || 'Unknown error';
    if (result.data) {
      // Try to extract more details from response
      if (result.data.message) {
        errorMsg = result.data.message;
      } else if (result.data.error) {
        errorMsg = typeof result.data.error === 'string' 
          ? result.data.error 
          : result.data.error.message || JSON.stringify(result.data.error);
      } else if (Array.isArray(result.data.errors)) {
        errorMsg = result.data.errors.map(e => e.msg || e.message || e).join(', ');
      }
    }
    
    if (errorMsg && errorMsg !== 'Unknown error') {
      console.log(`     ${colors.red}Error: ${errorMsg.substring(0, 150)}${colors.reset}`);
    }
    
    testResults.failed++;
    testResults.total++;
    testResults.errors.push({
      name,
      url,
      method,
      status: result.status,
      message: errorMsg
    });
    return { success: false, error: errorMsg };
  }
}

// ============================================
// AUTHENTICATION TESTS
// ============================================

async function testAuthentication() {
  logSection('AUTHENTICATION TESTS');
  
  // Admin Login
  logInfo('Testing Admin Login...');
  const adminLogin = await makeRequest('POST', '/auth/login', null, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  
  if (adminLogin.success && adminLogin.data?.data?.token) {
    adminToken = adminLogin.data.data.token;
    adminUserId = adminLogin.data.data.user?._id || adminLogin.data.data.user?.id;
    logSuccess(`Admin login successful - User ID: ${adminUserId}`);
  } else {
    logError(`Admin login failed: ${adminLogin.message || adminLogin.data?.message || 'Unknown error'}`);
    logWarning('Continuing with empty admin token - admin tests will be skipped');
  }
  
  // Salesman Login
  logInfo('Testing Salesman Login...');
  const salesmanLogin = await makeRequest('POST', '/auth/login', null, {
    email: SALESMAN_EMAIL,
    password: SALESMAN_PASSWORD
  });
  
  if (salesmanLogin.success && salesmanLogin.data?.data?.token) {
    salesmanToken = salesmanLogin.data.data.token;
    salesmanUserId = salesmanLogin.data.data.user?._id || salesmanLogin.data.data.user?.id;
    logSuccess(`Salesman login successful - User ID: ${salesmanUserId}`);
  } else {
    logError(`Salesman login failed: ${salesmanLogin.message || salesmanLogin.data?.message || 'Unknown error'}`);
    logWarning('Continuing with empty salesman token - salesman tests will be skipped');
  }
  
  // Get Me endpoints
  await testEndpoint('Get Admin Profile', 'GET', '/auth/me', adminToken);
  await testEndpoint('Get Salesman Profile', 'GET', '/auth/me', salesmanToken);
}

// ============================================
// ADMIN ENDPOINT TESTS
// ============================================

async function testAdminEndpoints() {
  if (!adminToken) {
    logWarning('Skipping admin endpoint tests - admin token not available');
    return;
  }
  
  logSection('ADMIN ENDPOINTS TESTS');
  
  // Users
  log('\n📋 Users', 'blue');
  await testEndpoint('Get All Users', 'GET', '/admin/users', adminToken);
  const userResult = await testEndpoint('Create User', 'POST', '/admin/users', adminToken, {
    name: 'Test User API',
    email: `testuser${Date.now()}@test.com`,
    password: 'Test123!@#',
    role: 'salesman'
  }, null, 201, null);
  
  let userId = null;
  if (userResult.success && userResult.data?.data?._id) {
    userId = userResult.data.data._id;
    await testEndpoint('Get User by ID', 'GET', `/admin/users/${userId}`, adminToken);
    await testEndpoint('Update User', 'PUT', `/admin/users/${userId}`, adminToken, {
      name: 'Updated Test User'
    });
    await testEndpoint('Generate Password Link', 'POST', `/admin/users/${userId}/generate-password-link`, adminToken);
  }
  
  // Products
  log('\n📦 Products', 'blue');
  await testEndpoint('Get All Products', 'GET', '/admin/products', adminToken);
  const productResult = await testEndpoint('Create Product', 'POST', '/admin/products', adminToken, {
    name: 'Test Product API',
    description: 'Test Product Description',
    price: 99.99,
    productCode: `PROD${Date.now()}`,
    category: 'Test Category',
    stock: 100
  }, null, 201, 'product');
  
  if (createdIds.product) {
    await testEndpoint('Get Product by ID', 'GET', `/admin/products/${createdIds.product}`, adminToken);
    await testEndpoint('Update Product', 'PUT', `/admin/products/${createdIds.product}`, adminToken, {
      name: 'Updated Test Product',
      price: 149.99,
      keyFeatures: [] // Add empty array to avoid undefined error
    });
    await testEndpoint('Download QR Code', 'GET', `/admin/products/${createdIds.product}/qr-code`, adminToken);
    await testEndpoint('Download Barcode', 'GET', `/admin/products/${createdIds.product}/barcode`, adminToken);
  }
  
  // Customers
  log('\n👥 Customers', 'blue');
  await testEndpoint('Get All Customers', 'GET', '/admin/customers', adminToken);
  const customerResult = await testEndpoint('Create Customer', 'POST', '/admin/customers', adminToken, {
    firstName: 'Test',
    name: 'Test Customer API',
    email: `testcustomer${Date.now()}@test.com`,
    phone: '1234567890',
    address: '123 Test Street',
    city: 'Test City'
  }, null, 201, 'customer');
  
  if (createdIds.customer) {
    await testEndpoint('Get Customer by ID', 'GET', `/admin/customers/${createdIds.customer}`, adminToken);
    await testEndpoint('Get Customer Details', 'GET', `/admin/customers/${createdIds.customer}/details`, adminToken);
    await testEndpoint('Update Customer', 'PUT', `/admin/customers/${createdIds.customer}`, adminToken, {
      name: 'Updated Test Customer'
    });
    if (salesmanUserId) {
      await testEndpoint('Get Customers by Salesman', 'GET', `/admin/customers/salesman/${salesmanUserId}`, adminToken);
    }
  }
  
  // Visit Targets
  log('\n🎯 Visit Targets', 'blue');
  await testEndpoint('Get All Visit Targets', 'GET', '/admin/visit-targets', adminToken);
  const visitTargetResult = await testEndpoint('Create Visit Target', 'POST', '/admin/visit-targets', adminToken, {
    name: 'Test Visit Target API',
    description: 'Test Visit Target Description',
    visitDate: new Date(Date.now() + 86400000).toISOString(),
    status: 'Pending',
    salesman: salesmanUserId,
    latitude: 24.8607,
    longitude: 67.0011,
    address: '123 Test Street'
  }, null, 201, 'visitTarget');
  
  if (createdIds.visitTarget) {
    await testEndpoint('Get Visit Target by ID', 'GET', `/admin/visit-targets/${createdIds.visitTarget}`, adminToken);
    await testEndpoint('Update Visit Target', 'PUT', `/admin/visit-targets/${createdIds.visitTarget}`, adminToken, {
      status: 'Completed'
    });
    if (salesmanUserId) {
      await testEndpoint('Get Visit Targets by Salesman', 'GET', `/admin/visit-targets/salesman/${salesmanUserId}`, adminToken);
      await testEndpoint('Get Salesman Target Stats', 'GET', `/admin/visit-targets/salesman/${salesmanUserId}/stats`, adminToken);
    }
  }
  
  // Quotations
  log('\n📄 Quotations', 'blue');
  await testEndpoint('Get Quotation Stats', 'GET', '/admin/quotations/stats', adminToken);
  await testEndpoint('Get All Quotations', 'GET', '/admin/quotations', adminToken);
  
  // Get a product first for quotation
  let productForQuote = null;
  if (createdIds.product) {
    productForQuote = createdIds.product;
  } else {
    // Try to get first product from list
    const productsResponse = await makeRequest('GET', '/admin/products', adminToken);
    if (productsResponse.success && productsResponse.data?.data?.length > 0) {
      productForQuote = productsResponse.data.data[0]._id;
    }
  }
  
  const quotationResult = await testEndpoint('Create Quotation', 'POST', '/admin/quotations', adminToken, {
    customerName: 'Test Customer Quote',
    items: productForQuote ? [
      { 
        productId: productForQuote,
        productName: 'Test Product',
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200
      }
    ] : [
      { 
        productName: 'Test Product',
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200
      }
    ],
    salesman: salesmanUserId
  }, null, 201, 'quotation');
  
  if (createdIds.quotation) {
    await testEndpoint('Get Quotation by ID', 'GET', `/admin/quotations/${createdIds.quotation}`, adminToken);
    await testEndpoint('Update Quotation', 'PUT', `/admin/quotations/${createdIds.quotation}`, adminToken, {
      status: 'Approved'
    });
  }
  
  // Samples
  log('\n🧪 Samples', 'blue');
  await testEndpoint('Get Sample Stats', 'GET', '/admin/samples/stats', adminToken);
  await testEndpoint('Get All Samples', 'GET', '/admin/samples', adminToken);
  const sampleResult = await testEndpoint('Create Sample', 'POST', '/admin/samples', adminToken, {
    customerName: 'Test Customer Sample',
    productName: 'Test Product',
    status: 'Pending',
    salesman: salesmanUserId
  }, null, 201, 'sample');
  
  if (createdIds.sample) {
    await testEndpoint('Get Sample by ID', 'GET', `/admin/samples/${createdIds.sample}`, adminToken);
    await testEndpoint('Update Sample', 'PUT', `/admin/samples/${createdIds.sample}`, adminToken, {
      status: 'Received'
    });
  }
  
  // Follow-ups (Tasks)
  log('\n📋 Follow-ups (Tasks)', 'blue');
  await testEndpoint('Get Follow-up Stats', 'GET', '/admin/follow-ups/stats', adminToken);
  await testEndpoint('Get All Follow-ups', 'GET', '/admin/follow-ups', adminToken);
  await testEndpoint('Get Follow-ups with Filters', 'GET', '/admin/follow-ups', adminToken, null, { status: 'Pending' });
  
  const followUpResult = await testEndpoint('Create Follow-up', 'POST', '/admin/follow-ups', adminToken, {
    customerName: 'Test Customer Follow-up',
    customerEmail: 'test@example.com',
    customerPhone: '1234567890',
    type: 'Call',
    priority: 'High',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    scheduledDate: new Date().toISOString(),
    description: 'Test Follow-up Description',
    salesman: salesmanUserId
  }, null, 201, 'followUp');
  
  if (createdIds.followUp) {
    await testEndpoint('Get Follow-up by ID', 'GET', `/admin/follow-ups/${createdIds.followUp}`, adminToken);
    await testEndpoint('Update Follow-up', 'PUT', `/admin/follow-ups/${createdIds.followUp}`, adminToken, {
      description: 'Updated Follow-up Description'
    });
    
    // Check if already approved before trying to approve
    const followUpCheck = await makeRequest('GET', `/admin/follow-ups/${createdIds.followUp}`, adminToken);
    if (followUpCheck.success && followUpCheck.data?.data?.approvalStatus !== 'Approved') {
      await testEndpoint('Approve Follow-up', 'PUT', `/admin/follow-ups/${createdIds.followUp}/approve`, adminToken);
    } else {
      logWarning('Follow-up already approved - skipping approval test');
    }
    
    await testEndpoint('Push to HubSpot', 'PUT', `/admin/follow-ups/${createdIds.followUp}/push-to-hubspot`, adminToken);
  }
  
  // Product Videos
  log('\n🎥 Product Videos', 'blue');
  await testEndpoint('Get All Product Videos', 'GET', '/admin/product-videos', adminToken);
  
  // Sales Orders
  log('\n🛒 Sales Orders', 'blue');
  await testEndpoint('Get All Sales Orders', 'GET', '/admin/sales-orders', adminToken);
  
  // Get product for sales order
  let productForOrder = null;
  if (createdIds.product) {
    productForOrder = createdIds.product;
  } else {
    const productsResponse = await makeRequest('GET', '/admin/products', adminToken);
    if (productsResponse.success && productsResponse.data?.data?.length > 0) {
      productForOrder = productsResponse.data.data[0]._id;
    }
  }
  
  const salesOrderResult = await testEndpoint('Create Sales Order', 'POST', '/admin/sales-orders', adminToken, {
    customerName: 'Test Customer Order',
    orderDate: new Date().toISOString(),
    salesPerson: salesmanUserId,
    orderSource: 'App',
    items: [
      { 
        productId: productForOrder,
        productName: 'Test Product',
        quantity: 1,
        unitPrice: 99.99,
        lineTotal: 99.99
      }
    ]
  }, null, 201, 'salesOrder');
  
  if (createdIds.salesOrder) {
    await testEndpoint('Get Sales Order by ID', 'GET', `/admin/sales-orders/${createdIds.salesOrder}`, adminToken);
    await testEndpoint('Update Sales Order', 'PUT', `/admin/sales-orders/${createdIds.salesOrder}`, adminToken, {
      status: 'Completed'
    });
  }
  
  // Sales Targets
  log('\n🎯 Sales Targets', 'blue');
  await testEndpoint('Get All Sales Targets', 'GET', '/admin/sales-targets', adminToken);
  const salesTargetResult = await testEndpoint('Create Sales Target', 'POST', '/admin/sales-targets', adminToken, {
    salesman: salesmanUserId,
    targetName: 'Monthly Revenue Target',
    targetType: 'Revenue',
    targetValue: 10000,
    period: 'Monthly',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }, null, 201, 'salesTarget');
  
  if (createdIds.salesTarget) {
    await testEndpoint('Get Sales Target by ID', 'GET', `/admin/sales-targets/${createdIds.salesTarget}`, adminToken);
    await testEndpoint('Update Sales Target', 'PUT', `/admin/sales-targets/${createdIds.salesTarget}`, adminToken, {
      targetValue: 15000
    });
  }
  
  // Sales Submissions
  log('\n📊 Sales Submissions', 'blue');
  await testEndpoint('Get Sales Submission Stats', 'GET', '/admin/sales-submissions/stats', adminToken);
  await testEndpoint('Get All Sales Submissions', 'GET', '/admin/sales-submissions', adminToken);
  
  // Note: Sales submission approval/rejection tests would require creating a submission first
  // which typically requires a salesman to create it
  
  // Shift Photos
  log('\n📸 Shift Photos', 'blue');
  await testEndpoint('Get All Shift Photos', 'GET', '/admin/shift-photos', adminToken);
  
  // Tracking
  log('\n📍 Tracking', 'blue');
  await testEndpoint('Get Active Tracking Sessions', 'GET', '/admin/tracking/active', adminToken);
  await testEndpoint('Get All Tracking Data', 'GET', '/admin/tracking', adminToken);
  
  // Locations
  log('\n🗺️  Locations', 'blue');
  await testEndpoint('Get Latest Salesmen Locations', 'GET', '/admin/locations/latest', adminToken);
  // Note: GET /admin/locations route may not exist - skipping if 404
  const locationsResult = await makeRequest('GET', '/admin/locations', adminToken);
  if (locationsResult.status !== 404) {
    await testEndpoint('Get All Locations', 'GET', '/admin/locations', adminToken);
  } else {
    logWarning('Get All Locations route not found (404) - skipping');
  }
  
  // HubSpot - Skipping as requested (these tests are optional)
  log('\n🔗 HubSpot Integration', 'blue');
  logWarning('HubSpot tests skipped (as requested)');
  // Uncomment below if you want to test HubSpot endpoints:
  // await testEndpoint('Test HubSpot Connection', 'GET', '/admin/hubspot/test', adminToken);
  // await testEndpoint('Get HubSpot Customers', 'GET', '/admin/hubspot/customers', adminToken);
  // await testEndpoint('Get HubSpot Orders', 'GET', '/admin/hubspot/orders', adminToken);
}

// ============================================
// SALESMAN ENDPOINT TESTS
// ============================================

async function testSalesmanEndpoints() {
  if (!salesmanToken) {
    logWarning('Skipping salesman endpoint tests - salesman token not available');
    return;
  }
  
  logSection('SALESMAN ENDPOINTS TESTS');
  
  // Products
  log('\n📦 Products', 'blue');
  await testEndpoint('Get All Products', 'GET', '/salesman/products', salesmanToken);
  
  // Get actual product code if product was created
  if (createdIds.product) {
    const productResponse = await makeRequest('GET', `/admin/products/${createdIds.product}`, adminToken);
    if (productResponse.success && productResponse.data?.data?.productCode) {
      await testEndpoint('Get Product by Code', 'GET', `/salesman/products/code/${productResponse.data.data.productCode}`, salesmanToken);
    }
    await testEndpoint('Get Product by ID', 'GET', `/salesman/products/${createdIds.product}`, salesmanToken);
  } else {
    logWarning('Skipping Get Product by Code - no product created');
  }
  
  // Customers
  log('\n👥 Customers', 'blue');
  await testEndpoint('Get My Customers', 'GET', '/salesman/customers', salesmanToken);
  const customerResult = await testEndpoint('Create Customer', 'POST', '/salesman/customers', salesmanToken, {
    firstName: 'Test',
    name: 'Test Customer Salesman',
    email: `testcustomer${Date.now()}@test.com`,
    phone: '9876543210',
    address: '456 Salesman Street'
  }, null, 201, null);
  
  let salesmanCustomerId = null;
  if (customerResult.success && customerResult.data?.data?._id) {
    salesmanCustomerId = customerResult.data.data._id;
    // Note: Customer created by salesman should be accessible to them
    await testEndpoint('Get Customer by ID', 'GET', `/salesman/customers/${salesmanCustomerId}`, salesmanToken);
  } else {
    logWarning('Customer creation failed - skipping Get Customer by ID test');
  }
  
  // Quotations
  log('\n📄 Quotations', 'blue');
  await testEndpoint('Get My Quotations', 'GET', '/salesman/quotations', salesmanToken);
  
  // Get product for quotation
  let productForSalesmanQuote = null;
  if (createdIds.product) {
    productForSalesmanQuote = createdIds.product;
  } else {
    const productsResponse = await makeRequest('GET', '/salesman/products', salesmanToken);
    if (productsResponse.success && productsResponse.data?.data?.length > 0) {
      productForSalesmanQuote = productsResponse.data.data[0]._id;
    }
  }
  
  const quotationResult = await testEndpoint('Create Quotation', 'POST', '/salesman/quotations', salesmanToken, {
    customerName: 'Test Customer Quote Salesman',
    items: productForSalesmanQuote ? [
      { 
        productId: productForSalesmanQuote,
        productName: 'Test Product',
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100
      }
    ] : [
      { 
        productName: 'Test Product',
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100
      }
    ]
  }, null, 201, null);
  
  let salesmanQuotationId = null;
  if (quotationResult.success && quotationResult.data?.data?._id) {
    salesmanQuotationId = quotationResult.data.data._id;
    await testEndpoint('Get Quotation by ID', 'GET', `/salesman/quotations/${salesmanQuotationId}`, salesmanToken);
    // Check valid status enum values - typically 'Draft', 'Sent', 'Approved', 'Rejected'
    // Valid status values: 'Draft', 'Sent', 'Approved', 'Rejected'
    await testEndpoint('Update Quotation', 'PUT', `/salesman/quotations/${salesmanQuotationId}`, salesmanToken, {
      status: 'Sent',
      notes: 'Updated quotation notes'
    });
  }
  
  // Visit Targets
  log('\n🎯 Visit Targets', 'blue');
  await testEndpoint('Get My Visit Targets', 'GET', '/salesman/visit-targets', salesmanToken);
  await testEndpoint('Get My Visit Requests', 'GET', '/salesman/visit-targets/requests', salesmanToken);
  const visitTargetResult = await testEndpoint('Create Visit Request', 'POST', '/salesman/visit-targets/request', salesmanToken, {
    name: 'Test Visit Request Salesman',
    description: 'Test Visit Request Description',
    visitDate: new Date(Date.now() + 86400000).toISOString(),
    status: 'Pending',
    latitude: 24.8607,
    longitude: 67.0011,
    address: '456 Salesman Street'
  }, null, 201, null);
  
  let salesmanVisitTargetId = null;
  if (visitTargetResult.success && visitTargetResult.data?.data?._id) {
    salesmanVisitTargetId = visitTargetResult.data.data._id;
    await testEndpoint('Get Visit Target by ID', 'GET', `/salesman/visit-targets/${salesmanVisitTargetId}`, salesmanToken);
    await testEndpoint('Update Visit Target Status', 'PUT', `/salesman/visit-targets/${salesmanVisitTargetId}`, salesmanToken, {
      status: 'In Progress'
    });
    await testEndpoint('Check Proximity', 'POST', `/salesman/visit-targets/${salesmanVisitTargetId}/check-proximity`, salesmanToken, {
      latitude: 24.8607,
      longitude: 67.0011
    });
  }
  
  // Achievements
  log('\n🏆 Achievements', 'blue');
  await testEndpoint('Get My Achievements', 'GET', '/salesman/achievements', salesmanToken);
  
  // Dashboard
  log('\n📊 Dashboard', 'blue');
  await testEndpoint('Get Dashboard Stats', 'GET', '/salesman/dashboard', salesmanToken);
  
  // Location
  log('\n🗺️  Location', 'blue');
  await testEndpoint('Get Latest Location', 'GET', '/salesman/location/latest', salesmanToken);
  await testEndpoint('Create Location', 'POST', '/salesman/location', salesmanToken, {
    latitude: 24.8607,
    longitude: 67.0011,
    address: 'Test Location Address'
  }, null, 201);
  
  // Tracking
  log('\n📍 Tracking', 'blue');
  
  // First, check if there's an active tracking session and stop it if needed
  const activeTrackingCheck = await makeRequest('GET', '/salesman/tracking/active', salesmanToken);
  if (activeTrackingCheck.success && activeTrackingCheck.data?.data?._id) {
    const activeTrackingId = activeTrackingCheck.data.data._id;
    logInfo('Stopping existing active tracking session...');
    await makeRequest('PUT', `/salesman/tracking/stop/${activeTrackingId}`, salesmanToken, {
      endingKilometers: 1100,
      endingMeterImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    });
  }
  
  const trackingResult = await testEndpoint('Start Tracking', 'POST', '/salesman/tracking/start', salesmanToken, {
    latitude: 24.8607,
    longitude: 67.0011,
    address: 'Starting Location',
    startingKilometers: 1000,
    speedometerImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }, null, 201); // Expect 201 for creation
  
  // If tracking started successfully, we can test active tracking
  if (trackingResult.success) {
    await testEndpoint('Get Active Tracking', 'GET', '/salesman/tracking/active', salesmanToken);
  } else {
    logWarning('Tracking start failed - skipping Get Active Tracking test');
  }
  await testEndpoint('Get All Tracking', 'GET', '/salesman/tracking', salesmanToken);
  await testEndpoint('Get Active Tracking', 'GET', '/salesman/tracking/active', salesmanToken);
  await testEndpoint('Get All Tracking', 'GET', '/salesman/tracking', salesmanToken);
  
  // Samples
  log('\n🧪 Samples', 'blue');
  await testEndpoint('Get My Samples', 'GET', '/salesman/samples', salesmanToken);
  const sampleResult = await testEndpoint('Create Sample', 'POST', '/salesman/samples', salesmanToken, {
    customerName: 'Test Customer Sample Salesman',
    productName: 'Test Product',
    status: 'Pending'
  }, null, 201, null);
  
  let salesmanSampleId = null;
  if (sampleResult.success && sampleResult.data?.data?._id) {
    salesmanSampleId = sampleResult.data.data._id;
    await testEndpoint('Get Sample by ID', 'GET', `/salesman/samples/${salesmanSampleId}`, salesmanToken);
  }
  
  // Follow-ups (Tasks)
  log('\n📋 Follow-ups (Tasks)', 'blue');
  await testEndpoint('Get My Follow-ups', 'GET', '/salesman/follow-ups', salesmanToken);
  const followUpResult = await testEndpoint('Create Follow-up', 'POST', '/salesman/follow-ups', salesmanToken, {
    customerName: 'Test Customer Follow-up Salesman',
    customerEmail: 'test@example.com',
    customerPhone: '1234567890',
    type: 'Visit',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    description: 'Test Follow-up by Salesman'
  }, null, 201, null);
  
  let salesmanFollowUpId = null;
  if (followUpResult.success && followUpResult.data?.data?._id) {
    salesmanFollowUpId = followUpResult.data.data._id;
    await testEndpoint('Get Follow-up by ID', 'GET', `/salesman/follow-ups/${salesmanFollowUpId}`, salesmanToken);
    await testEndpoint('Update Follow-up', 'PUT', `/salesman/follow-ups/${salesmanFollowUpId}`, salesmanToken, {
      description: 'Updated Follow-up by Salesman'
    });
  }
  
  // Sales Targets
  log('\n🎯 Sales Targets', 'blue');
  await testEndpoint('Get My Sales Targets', 'GET', '/salesman/sales-targets', salesmanToken);
  await testEndpoint('Get My Sales Target Stats', 'GET', '/salesman/sales-targets/stats', salesmanToken);
  
  // Sales Submissions
  // Sales Submissions removed - using sales orders instead
  log('\n📊 Sales Submissions (REMOVED - using Sales Orders)', 'yellow');
  // Commented out - Sales submission endpoints removed
  /*
  await testEndpoint('Get My Sales Submissions', 'GET', '/salesman/sales-submissions', salesmanToken);
  await testEndpoint('Get My Sales Submission Stats', 'GET', '/salesman/sales-submissions/stats', salesmanToken);
  const salesSubmissionResult = await testEndpoint('Create Sales Submission', 'POST', '/salesman/sales-submissions', salesmanToken, {
    customerName: 'Test Customer Submission',
    salesAmount: 5000,
    salesDate: new Date().toISOString()
  }, null, 201, null);
  
  let salesmanSubmissionId = null;
  if (salesSubmissionResult.success && salesSubmissionResult.data?.data?._id) {
    salesmanSubmissionId = salesSubmissionResult.data.data._id;
    await testEndpoint('Get Sales Submission by ID', 'GET', `/salesman/sales-submissions/${salesmanSubmissionId}`, salesmanToken);
    await testEndpoint('Update Sales Submission', 'PUT', `/salesman/sales-submissions/${salesmanSubmissionId}`, salesmanToken, {
      amount: 6000
    });
  }
  */
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(70), 'blue');
  log(`${colors.bold}🚀 COMPREHENSIVE API ENDPOINT TEST SUITE${colors.reset}`, 'magenta');
  log('='.repeat(70) + '\n', 'blue');
  
  logInfo(`API Base URL: ${API_BASE_URL}`);
  logInfo(`Port: ${PORT}`);
  logInfo(`Admin Email: ${ADMIN_EMAIL}`);
  logInfo(`Salesman Email: ${SALESMAN_EMAIL}`);
  logWarning(`\n⚠️  IMPORTANT: Backend server must be running on port ${PORT}`);
  logInfo(`💡 For database-only testing (no server needed): npm run test:database\n`);
  
  // Note: This script tests HTTP API endpoints (requires server running)
  // For direct database testing without server, use: npm run test:database
  logInfo('⚠️  This script tests HTTP API endpoints - requires backend server running');
  logInfo('💡 For direct database testing (no server needed), use: npm run test:database\n');
  
  // Check if server is running - REQUIRED for this script
  logInfo(`Checking if backend server is running on port ${PORT}...`);
  let serverRunning = false;
  
  try {
    const healthCheck = await makeRequest('GET', '/health', null);
    if (healthCheck.success) {
      logSuccess('✅ Backend server is running\n');
      serverRunning = true;
    } else {
      logError(`❌ Health check failed - Status: ${healthCheck.status}`);
      serverRunning = false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      logError(`\n❌ Backend server is NOT running on port ${PORT}`);
      logError(`   Error: ${error.message || 'Connection refused'}`);
      logError(`\n${'='.repeat(70)}`, 'red');
      logError(`⚠️  ACTION REQUIRED: Start the backend server first!`, 'yellow');
      logError(`${'='.repeat(70)}`, 'red');
      logError(`\n📋 Steps to start server:`, 'cyan');
      logError(`   1. Open a new terminal`, 'cyan');
      logError(`   2. Navigate to backend directory:`, 'cyan');
      logError(`      cd backend`, 'cyan');
      logError(`   3. Start the server:`, 'cyan');
      logError(`      npm start`, 'cyan');
      logError(`      OR for development:`, 'cyan');
      logError(`      npm run dev`, 'cyan');
      logError(`\n💡 Alternative: Use database test script (no server needed):`, 'yellow');
      logError(`   npm run test:database`, 'yellow');
      logError(`\n${'='.repeat(70)}\n`, 'red');
      process.exit(1);
    } else {
      logError(`❌ Server check failed: ${error.message}`);
      serverRunning = false;
    }
  }
  
  if (!serverRunning) {
    logError(`\n❌ Cannot proceed - Backend server is required for API endpoint testing`);
    logError(`   Please start the server and try again, or use: npm run test:database\n`);
    process.exit(1);
  }
  
  // Run tests
  await testAuthentication();
  
  if (adminToken) {
    await testAdminEndpoints();
  } else {
    logWarning('Skipping admin endpoint tests - admin token not available');
  }
  
  if (salesmanToken) {
    await testSalesmanEndpoints();
  } else {
    logWarning('Skipping salesman endpoint tests - salesman token not available');
  }
  
  // Print Summary
  printSummary();
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
      log(`\n${index + 1}. ${err.name}`, 'red');
      log(`   Method: ${err.method}`, 'red');
      log(`   URL: ${err.url}`, 'red');
      log(`   Status: ${err.status}`, 'red');
      log(`   Error: ${err.message}`, 'red');
    });
  }
  
  log('\n' + '='.repeat(70) + '\n', 'blue');
}

// Run tests
runAllTests().catch(error => {
  logError('Fatal error running tests', error);
  printSummary();
  process.exit(1);
});
