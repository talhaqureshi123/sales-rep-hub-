const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const User = require('../database/models/User');
const Location = require('../database/models/Location');

const checkUsmanLocation = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Find Usman
    const usman = await User.findOne({ 
      $or: [
        { name: { $regex: /usman/i } },
        { email: { $regex: /usman/i } }
      ],
      role: 'salesman'
    });

    if (!usman) {
      console.log('❌ Usman not found');
      process.exit(1);
    }

    console.log(`👤 Found Usman: ${usman.name} (${usman.email})`);
    console.log(`   ID: ${usman._id}`);
    console.log(`   Role: ${usman.role}`);
    console.log(`   Status: ${usman.status}`);
    console.log(`   Last Activity: ${usman.lastActivity ? new Date(usman.lastActivity).toLocaleString() : 'Never'}\n`);

    // Check if Usman is online (within last 5 minutes)
    const now = Date.now();
    const activeWithinMs = 5 * 60 * 1000; // 5 minutes
    const lastActivityMs = usman.lastActivity ? new Date(usman.lastActivity).getTime() : null;
    const isOnlineByActivity = lastActivityMs && (now - lastActivityMs) <= activeWithinMs;
    
    console.log(`📊 Online Status:`);
    console.log(`   Based on lastActivity: ${isOnlineByActivity ? '✅ Online' : '❌ Offline'}`);
    if (lastActivityMs) {
      const minutesAgo = Math.round((now - lastActivityMs) / 60000);
      console.log(`   Last activity: ${minutesAgo} minutes ago`);
    }

    // Check location data
    const locations = await Location.find({ salesman: usman._id })
      .sort({ timestamp: -1 })
      .limit(10);

    console.log(`\n📍 Location Data:`);
    console.log(`   Total locations: ${locations.length}`);

    if (locations.length === 0) {
      console.log(`   ❌ No location data found for Usman`);
      console.log(`\n💡 This means:`);
      console.log(`   - Usman hasn't started tracking yet`);
      console.log(`   - OR Usman started tracking but location updates aren't being saved`);
      console.log(`   - OR Location API is not working`);
    } else {
      const latestLocation = locations[0];
      console.log(`   ✅ Latest location:`);
      console.log(`      Latitude: ${latestLocation.latitude}`);
      console.log(`      Longitude: ${latestLocation.longitude}`);
      console.log(`      Accuracy: ${latestLocation.accuracy || 'N/A'} meters`);
      console.log(`      Timestamp: ${new Date(latestLocation.timestamp).toLocaleString()}`);
      
      // Check if location is recent
      const locationMs = new Date(latestLocation.timestamp).getTime();
      const isOnlineByLocation = (now - locationMs) <= activeWithinMs;
      const minutesAgo = Math.round((now - locationMs) / 60000);
      
      console.log(`      Age: ${minutesAgo} minutes ago`);
      console.log(`      Status: ${isOnlineByLocation ? '✅ Recent (Online)' : '❌ Old (Offline)'}`);
      
      console.log(`\n   📋 Last 5 locations:`);
      locations.slice(0, 5).forEach((loc, i) => {
        const age = Math.round((now - new Date(loc.timestamp).getTime()) / 60000);
        console.log(`      ${i + 1}. ${loc.latitude}, ${loc.longitude} - ${age} min ago`);
      });
    }

    // Check what the API would return
    console.log(`\n🔍 What Live Tracking API would return:`);
    const LocationModel = require('../database/models/Location');
    const latestLocationDoc = await LocationModel.findOne({ salesman: usman._id })
      .sort({ timestamp: -1 });

    let ts = null;
    if (latestLocationDoc?.timestamp) {
      ts = new Date(latestLocationDoc.timestamp).getTime();
    } else if (usman.lastActivity) {
      ts = new Date(usman.lastActivity).getTime();
    }
    
    const lastSeenMs = ts ? now - ts : null;
    const isOnline = typeof lastSeenMs === "number" && lastSeenMs <= activeWithinMs;

    console.log(`   Latest Location: ${latestLocationDoc ? '✅ Found' : '❌ Not Found'}`);
    console.log(`   Is Online: ${isOnline ? '✅ Yes' : '❌ No'}`);
    console.log(`   Last Seen: ${lastSeenMs ? Math.round(lastSeenMs / 60000) + ' minutes ago' : 'Never'}`);
    
    if (latestLocationDoc) {
      console.log(`   Location Data:`);
      console.log(`      Latitude: ${latestLocationDoc.latitude}`);
      console.log(`      Longitude: ${latestLocationDoc.longitude}`);
      console.log(`      Timestamp: ${new Date(latestLocationDoc.timestamp).toLocaleString()}`);
    } else {
      console.log(`   ⚠️  No location data - Usman will show as online but won't appear on map`);
    }

    console.log('\n✅ Check completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  checkUsmanLocation();
}

module.exports = checkUsmanLocation;
