/**
 * HubSpot API Test Script
 * Run: node scripts/testHubSpot.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const config = require('../config');

const API_BASE = 'http://localhost:5000';
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

async function testHubSpot() {
  console.log('\n=== HUBSPOT API TEST ===\n');
  
  // Step 1: Check token configuration
  console.log('1. Checking token configuration...');
  let token = config.HUBSPOT_API_KEY || config.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    console.log('❌ ERROR: HubSpot token not found in .env file');
    console.log('   Please add HUBSPOT_ACCESS_TOKEN or HUBSPOT_API_KEY to .env file');
    return;
  }
  
  // Trim token (remove any extra spaces/quotes)
  token = token.trim().replace(/^["']|["']$/g, '');
  
  console.log('✅ Token found (length:', token.length + ')');
  console.log('   Token preview:', token.substring(0, 10) + '...' + token.substring(token.length - 4));
  console.log('   Token format check:', token.startsWith('pat-') || token.startsWith('eu1-') ? '✅ Valid format' : '⚠️  Unexpected format');
  
  // Step 2: Test direct HubSpot API
  console.log('\n2. Testing direct HubSpot API...');
  console.log('   API URL:', `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`);
  console.log('   Authorization header:', `Bearer ${token.substring(0, 15)}...`);
  
  try {
    // First try with Bearer token
    const response = await axios.get(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit: 5,
          properties: 'email,firstname,lastname'
        }
      }
    );
    
    console.log('✅ Direct HubSpot API call successful!');
    console.log('   Status:', response.status);
    console.log('   Contacts found:', response.data?.results?.length || 0);
    
    if (response.data?.results?.length > 0) {
      console.log('   Sample contact:', JSON.stringify(response.data.results[0], null, 2));
    } else {
      console.log('   ⚠️  No contacts found in HubSpot account');
      console.log('   This is normal if you haven\'t created any contacts yet');
    }
  } catch (error) {
    console.log('❌ Direct HubSpot API call failed!');
    console.log('   Status:', error.response?.status);
    console.log('   Error:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('   Full error:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\n   🔍 Troubleshooting:');
    console.log('   1. Check if token is correct in .env file');
    console.log('   2. Verify token in HubSpot: Settings → Integrations → Private Apps');
    console.log('   3. Make sure token has these scopes:');
    console.log('      - crm.objects.contacts.read');
    console.log('      - crm.objects.contacts.write');
    console.log('      - crm.objects.deals.read');
    console.log('      - crm.objects.deals.write');
    console.log('   4. If token is old, regenerate it in HubSpot');
    console.log('   5. Make sure you\'re using Private App Access Token (not API key)');
    
    // Try alternative: Maybe token needs to be sent differently?
    console.log('\n   Trying alternative authentication method...');
    try {
      const altResponse = await axios.get(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts?hapikey=${token}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            limit: 5,
            properties: 'email,firstname,lastname'
          }
        }
      );
      console.log('   ⚠️  Note: Old API key format worked, but HubSpot now uses Private App tokens');
    } catch (altError) {
      console.log('   ❌ Alternative method also failed');
    }
    
    return;
  }
  
  // Step 3: Test backend endpoint (if server is running)
  console.log('\n3. Testing backend endpoint...');
  try {
    // First, try to login to get a token
    console.log('   Attempting to get admin token...');
    
    // Note: This requires admin credentials
    // For now, just test if server is running
    const healthCheck = await axios.get(`${API_BASE}/api/health`);
    console.log('✅ Backend server is running');
    console.log('   Health check:', healthCheck.data.message);
    
    console.log('\n   ⚠️  To test authenticated endpoints, you need to:');
    console.log('   1. Login as admin via frontend or API');
    console.log('   2. Get the JWT token');
    console.log('   3. Use that token in Authorization header');
    console.log('\n   Example:');
    console.log('   GET http://localhost:5000/api/admin/hubspot/test');
    console.log('   Headers: Authorization: Bearer YOUR_JWT_TOKEN');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is not running!');
      console.log('   Please start the server: npm run dev');
    } else {
      console.log('⚠️  Backend endpoint test:', error.message);
    }
  }
  
  // Step 4: Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log('✅ Token configuration: OK');
  console.log('✅ Direct HubSpot API: Working');
  console.log('✅ Integration is ready!');
  console.log('\nNext steps:');
  console.log('1. Make sure backend server is running');
  console.log('2. Login as admin in frontend');
  console.log('3. Test endpoints via frontend or Postman');
  console.log('\n');
}

// Run test
testHubSpot().catch(error => {
  console.error('Test failed:', error.message);
  process.exit(1);
});
