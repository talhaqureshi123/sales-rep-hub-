/**
 * Test My Contacts Import Script
 * Tests importing only MY contacts from HubSpot
 * 
 * Usage: node scripts/testMyContactsImport.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const Customer = require('../database/models/Customer');
const hubspotService = require('../services/hubspotService');

// Logging helpers
const logInfo = (msg) => console.log(`ℹ️  ${msg}`);
const logSuccess = (msg) => console.log(`✅ ${msg}`);
const logError = (msg) => console.error(`❌ ${msg}`);
const logWarning = (msg) => console.warn(`⚠️  ${msg}`);

async function main() {
  try {
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected');

    // Step 1: Get current HubSpot user ID
    logInfo('\n📋 Step 1: Getting current HubSpot user ID...');
    const currentUserId = await hubspotService.getCurrentHubSpotUserId();
    
    if (!currentUserId) {
      logWarning('Could not determine HubSpot user ID. This might be a Private App token.');
      logWarning('Will proceed with import test, but cannot verify ownership.');
    } else {
      logSuccess(`Current HubSpot User ID: ${currentUserId}`);
    }

    // Step 2: Fetch MY contacts from HubSpot
    logInfo('\n📋 Step 2: Fetching MY contacts from HubSpot...');
    const myContacts = await hubspotService.fetchCustomers({ myContactsOnly: true });
    logSuccess(`Found ${myContacts.length} MY contacts in HubSpot`);

    // Step 3: Fetch ALL contacts from HubSpot (for comparison)
    logInfo('\n📋 Step 3: Fetching ALL contacts from HubSpot (for comparison)...');
    const allContacts = await hubspotService.fetchCustomers({ myContactsOnly: false });
    logInfo(`Found ${allContacts.length} total contacts in HubSpot`);

    // Step 4: Show comparison
    console.log('\n📊 Comparison:');
    console.log(`   Total contacts in HubSpot: ${allContacts.length}`);
    console.log(`   MY contacts in HubSpot: ${myContacts.length}`);
    console.log(`   Other contacts: ${allContacts.length - myContacts.length}`);

    // Step 5: Check if MY contacts have correct owner ID
    if (currentUserId && myContacts.length > 0) {
      logInfo('\n📋 Step 4: Verifying MY contacts ownership...');
      let correctOwnerCount = 0;
      let wrongOwnerCount = 0;
      let noOwnerCount = 0;

      myContacts.forEach((contact) => {
        const ownerId = contact.properties?.hubspot_owner_id;
        if (!ownerId) {
          noOwnerCount++;
        } else if (String(ownerId) === String(currentUserId)) {
          correctOwnerCount++;
        } else {
          wrongOwnerCount++;
          logWarning(`Contact ${contact.id} has wrong owner: ${ownerId} (expected: ${currentUserId})`);
        }
      });

      console.log('\n📊 Ownership Verification:');
      console.log(`   Contacts with correct owner (${currentUserId}): ${correctOwnerCount}`);
      console.log(`   Contacts with wrong owner: ${wrongOwnerCount}`);
      console.log(`   Contacts with no owner: ${noOwnerCount}`);
      
      if (wrongOwnerCount > 0) {
        logError(`⚠️  Found ${wrongOwnerCount} contacts with wrong owner!`);
      } else if (noOwnerCount > 0) {
        logWarning(`⚠️  Found ${noOwnerCount} contacts with no owner assigned`);
      } else {
        logSuccess('All MY contacts have correct owner!');
      }
    }

    // Step 6: Check current database count
    logInfo('\n📋 Step 5: Checking database...');
    const dbCount = await Customer.countDocuments();
    logInfo(`Current customers in database: ${dbCount}`);

    if (dbCount === 0) {
      logWarning('Database is empty. Import customers using the UI with "My Contacts Only" checked.');
      logInfo('After importing, run this script again to verify.');
    } else {
      logInfo(`Database has ${dbCount} customers`);
      logInfo('To test import, delete all customers first, then import with "My Contacts Only" checked.');
    }

    logSuccess('\n✅ Test completed successfully');
    console.log('\n💡 Next Steps:');
    console.log('   1. Go to HubSpot Connect page');
    console.log('   2. Check "My Contacts Only" checkbox');
    console.log('   3. Click "Import Customers"');
    console.log('   4. Run this script again to verify only MY contacts were imported');
    
    process.exit(0);
  } catch (error) {
    logError(`Script failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
