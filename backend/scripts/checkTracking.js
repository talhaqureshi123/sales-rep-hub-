const connectDB = require('../database/connection');
const Tracking = require('../database/models/Tracking');
const User = require('../database/models/User'); // Required for populate

(async () => {
  try {
    await connectDB();
    const tracking = await Tracking.findById('697a125482384dbe64573bc2').populate('salesman', 'name email');
    if (tracking) {
      console.log('✅ Tracking found:');
      console.log('   ID:', tracking._id.toString());
      console.log('   Salesman:', tracking.salesman ? `${tracking.salesman.name} (${tracking.salesman.email})` : 'N/A');
      console.log('   Status:', tracking.status);
      console.log('   Started At:', tracking.startedAt);
      console.log('   Stopped At:', tracking.stoppedAt);
      console.log('   Speedometer Image:', tracking.speedometerImage ? 'EXISTS' : 'MISSING');
      console.log('   Ending Meter Image:', tracking.endingMeterImage ? 'EXISTS' : 'MISSING');
      console.log('   Visited Area Image:', tracking.visitedAreaImage ? 'EXISTS' : 'MISSING');
      
      // Check all trackings
      const allTrackings = await Tracking.find({}).populate('salesman', 'name email');
      console.log(`\n📊 Total Trackings in DB: ${allTrackings.length}`);
      allTrackings.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t._id} - ${t.salesman?.name || 'N/A'} - Status: ${t.status} - Started: ${t.startedAt}`);
      });
    } else {
      console.log('❌ Tracking NOT FOUND');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
