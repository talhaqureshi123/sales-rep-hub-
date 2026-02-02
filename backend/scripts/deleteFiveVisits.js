/**
 * Delete exactly 5 visit targets from the database.
 * Usage: node backend/scripts/deleteFiveVisits.js
 */

const mongoose = require('mongoose');
const config = require('../config');
const VisitTarget = require('../database/models/VisitTarget');

const LIMIT = 5;

const deleteFiveVisits = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    const countBefore = await VisitTarget.countDocuments();
    console.log(`📊 Total visits before: ${countBefore}`);

    if (countBefore === 0) {
      console.log('ℹ️  No visits to delete.');
      await mongoose.connection.close();
      return;
    }

    const toDelete = await VisitTarget.find({}).limit(LIMIT).select('_id name status').lean();
    const ids = toDelete.map((d) => d._id);

    if (ids.length === 0) {
      console.log('ℹ️  No visits to delete.');
      await mongoose.connection.close();
      return;
    }

    const result = await VisitTarget.deleteMany({ _id: { $in: ids } });
    console.log(`✅ Deleted ${result.deletedCount} visit(s):`);
    toDelete.forEach((d, i) => console.log(`   ${i + 1}. ${d.name || d._id} (${d.status})`));

    const countAfter = await VisitTarget.countDocuments();
    console.log(`📊 Total visits after: ${countAfter}`);

    await mongoose.connection.close();
    console.log('✅ Done.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

deleteFiveVisits();
