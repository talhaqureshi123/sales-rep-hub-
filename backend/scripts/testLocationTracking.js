/**
 * Location Tracking Test Script
 * Tests the complete location tracking flow:
 * 1. Salesman saves location
 * 2. Admin fetches latest locations
 * 3. Online/Offline status detection
 */

const axios = require('axios');
const config = require('../config');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${config.PORT || 4000}`;
const SALESMAN_EMAIL = process.env.TEST_SALESMAN_EMAIL || 'salesman@test.com';
const SALESMAN_PASSWORD = process.env.TEST_SALESMAN_PASSWORD || 'password123';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123';

let salesmanToken = null;
let adminToken = null;
let salesmanId = null;

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

// Test 1: Login as Salesman
async function loginSalesman() {
  log('\n📱 Test 1: Salesman Login', 'cyan');
  try {
    const response = await axios.post(`${API_BASE_URL}/api/salesman/auth/login`, {
      email: SALESMAN_EMAIL,
      password: SALESMAN_PASSWORD,
    });

    if (response.data.success && response.data.token) {
      salesmanToken = response.data.token;
      salesmanId = response.data.user?._id || response.data.user?.id;
      log(`✅ Salesman logged in successfully`, 'green');
      log(`   User ID: ${salesmanId}`, 'blue');
      return true;
    } else {
      log(`❌ Login failed: ${response.data.message || 'Unknown error'}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Login error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 2: Save Location (as Salesman)
async function saveLocation(latitude, longitude, accuracy = 10) {
  log(`\n📍 Test 2: Save Location (${latitude}, ${longitude})`, 'cyan');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/salesman/location`,
      {
        latitude,
        longitude,
        accuracy,
      },
      {
        headers: {
          Authorization: `Bearer ${salesmanToken}`,
        },
      }
    );

    if (response.data.success) {
      log(`✅ Location saved successfully`, 'green');
      log(`   Location ID: ${response.data.data?._id}`, 'blue');
      log(`   Timestamp: ${new Date(response.data.data?.timestamp).toLocaleString()}`, 'blue');
      return true;
    } else {
      log(`❌ Failed to save location: ${response.data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error saving location: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 3: Login as Admin
async function loginAdmin() {
  log('\n👤 Test 3: Admin Login', 'cyan');
  try {
    const response = await axios.post(`${API_BASE_URL}/api/admin/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (response.data.success && response.data.token) {
      adminToken = response.data.token;
      log(`✅ Admin logged in successfully`, 'green');
      return true;
    } else {
      log(`❌ Login failed: ${response.data.message || 'Unknown error'}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Login error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 4: Get Latest Locations (as Admin)
async function getLatestLocations() {
  log('\n🗺️  Test 4: Get Latest Salesmen Locations', 'cyan');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/admin/locations/latest?activeWithinMinutes=5`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    if (response.data.success) {
      log(`✅ Locations fetched successfully`, 'green');
      log(`   Total Salesmen: ${response.data.count}`, 'blue');
      log(`   Online Salesmen: ${response.data.onlineCount}`, 'blue');
      log(`   Active Window: ${response.data.activeWithinMinutes} minutes`, 'blue');

      // Find our test salesman
      const salesmanData = response.data.data.find(
        (item) => item.salesman?._id === salesmanId || item.salesman?.email === SALESMAN_EMAIL
      );

      if (salesmanData) {
        log(`\n   📍 Test Salesman Found:`, 'yellow');
        log(`      Name: ${salesmanData.salesman?.name || salesmanData.salesman?.email}`, 'blue');
        log(`      Status: ${salesmanData.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`, salesmanData.isOnline ? 'green' : 'red');
        
        if (salesmanData.latestLocation) {
          log(`      Latest Location:`, 'blue');
          log(`         Latitude: ${salesmanData.latestLocation.latitude}`, 'blue');
          log(`         Longitude: ${salesmanData.latestLocation.longitude}`, 'blue');
          log(`         Accuracy: ${salesmanData.latestLocation.accuracy || 'N/A'}m`, 'blue');
          log(`         Timestamp: ${new Date(salesmanData.latestLocation.timestamp).toLocaleString()}`, 'blue');
          
          if (salesmanData.lastSeenMs !== null) {
            const lastSeenSeconds = Math.floor(salesmanData.lastSeenMs / 1000);
            log(`         Last Seen: ${lastSeenSeconds} seconds ago`, 'blue');
          }
        } else {
          log(`      ⚠️  No location data found`, 'yellow');
        }
      } else {
        log(`   ⚠️  Test salesman not found in results`, 'yellow');
      }

      return true;
    } else {
      log(`❌ Failed to fetch locations: ${response.data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error fetching locations: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 5: Test Multiple Location Updates
async function testMultipleLocations() {
  log('\n🔄 Test 5: Multiple Location Updates', 'cyan');
  
  const locations = [
    { lat: 28.6139, lng: 77.2090, name: 'Delhi' },
    { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
    { lat: 12.9716, lng: 77.5946, name: 'Bangalore' },
  ];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    log(`\n   Sending location ${i + 1}/${locations.length}: ${loc.name}`, 'blue');
    await saveLocation(loc.lat, loc.lng, 15);
    
    // Wait 2 seconds between updates
    if (i < locations.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Wait a bit then check latest location
  log(`\n   Waiting 3 seconds before checking latest location...`, 'blue');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await getLatestLocations();
}

// Test 6: Test Online/Offline Status
async function testOnlineOfflineStatus() {
  log('\n⏱️  Test 6: Online/Offline Status Detection', 'cyan');
  
  // Send a fresh location (should be online)
  log(`\n   Sending fresh location (should be ONLINE)...`, 'blue');
  await saveLocation(28.7041, 77.1025, 12);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  log(`\n   Checking status immediately (should be ONLINE)...`, 'blue');
  await getLatestLocations();
  
  log(`\n   ⚠️  Note: To test OFFLINE status, wait more than 5 minutes`, 'yellow');
  log(`      or change activeWithinMinutes parameter`, 'yellow');
}

// Main test function
async function runTests() {
  log('\n🚀 Starting Location Tracking Tests...', 'cyan');
  log('='.repeat(60), 'cyan');

  const results = {
    passed: 0,
    failed: 0,
    total: 0,
  };

  try {
    // Test 1: Login as Salesman
    results.total++;
    if (await loginSalesman()) {
      results.passed++;
    } else {
      results.failed++;
      log('\n❌ Cannot continue without salesman login', 'red');
      return;
    }

    // Test 2: Save Location
    results.total++;
    if (await saveLocation(28.6139, 77.2090, 10)) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Test 3: Login as Admin
    results.total++;
    if (await loginAdmin()) {
      results.passed++;
    } else {
      results.failed++;
      log('\n❌ Cannot continue without admin login', 'red');
      return;
    }

    // Test 4: Get Latest Locations
    results.total++;
    if (await getLatestLocations()) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Test 5: Multiple Location Updates
    results.total++;
    if (await testMultipleLocations()) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Test 6: Online/Offline Status
    results.total++;
    if (await testOnlineOfflineStatus()) {
      results.passed++;
    } else {
      results.failed++;
    }

  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    results.failed++;
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('\n📊 Test Summary:', 'cyan');
  log(`   Total Tests: ${results.total}`, 'blue');
  log(`   ✅ Passed: ${results.passed}`, 'green');
  log(`   ❌ Failed: ${results.failed}`, 'red');
  log(`   Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 
    results.passed === results.total ? 'green' : 'yellow');

  if (results.failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please check the errors above.', 'yellow');
  }
}

// Run tests
if (require.main === module) {
  runTests().catch((error) => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runTests };
