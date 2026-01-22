/**
 * Debug Script: Test "My Contacts" Fetch from HubSpot
 * 
 * This script helps debug why "My Contacts" might not be working
 * 
 * Usage: node scripts/testMyContactsDebug.js
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
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

    logInfo('\n📋 Step 1: Testing getCurrentHubSpotUserId()...');
    const currentUserId = await hubspotService.getCurrentHubSpotUserId();
    
    if (!currentUserId) {
      logWarning('❌ Could not determine HubSpot user/owner ID');
      logWarning('   This means "My Contacts" filter will not work');
      logWarning('   Possible reasons:');
      logWarning('   1. Using Private App token (no user context)');
      logWarning('   2. Token does not have required permissions');
      logWarning('   3. API endpoints are not accessible');
    } else {
      logSuccess(`✅ Current HubSpot Owner ID: ${currentUserId}`);
    }

    logInfo('\n📋 Step 2: Fetching ALL contacts from HubSpot...');
    const allContacts = await hubspotService.fetchCustomers({ myContactsOnly: false });
    logInfo(`Found ${allContacts.length} total contacts in HubSpot`);

    if (allContacts.length > 0) {
      // Check owner IDs in the contacts
      const ownerIds = new Set();
      allContacts.forEach(c => {
        const ownerId = c?.properties?.hubspot_owner_id;
        if (ownerId) {
          ownerIds.add(String(ownerId));
        }
      });
      
      logInfo(`\n📊 Owner Analysis:`);
      logInfo(`   Unique owner IDs found: ${ownerIds.size}`);
      logInfo(`   Owner IDs: ${Array.from(ownerIds).join(', ')}`);
      
      if (currentUserId) {
        const myContactsCount = allContacts.filter(c => 
          String(c?.properties?.hubspot_owner_id) === String(currentUserId)
        ).length;
        logInfo(`   Contacts owned by you (${currentUserId}): ${myContactsCount}`);
        
        if (myContactsCount === 0) {
          logWarning('   ⚠️  No contacts found with your owner ID!');
          logWarning('   This could mean:');
          logWarning('   1. You don\'t own any contacts in HubSpot');
          logWarning('   2. The owner ID detection is incorrect');
        }
      }
    }

    logInfo('\n📋 Step 3: Fetching MY contacts (with filter)...');
    const myContacts = await hubspotService.fetchCustomers({ myContactsOnly: true });
    logInfo(`Found ${myContacts.length} MY contacts (with filter)`);

    logInfo('\n📊 Summary:');
    console.log(`   Total contacts: ${allContacts.length}`);
    console.log(`   MY contacts (filtered): ${myContacts.length}`);
    if (currentUserId) {
      console.log(`   Your Owner ID: ${currentUserId}`);
    } else {
      console.log(`   Your Owner ID: ❌ NOT FOUND`);
    }

    logSuccess('\n✅ Debug script completed');
    process.exit(0);
  } catch (error) {
    logError(`Script failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
