/**
 * Script to delete all visit targets from the database
 * Usage: node backend/scripts/deleteAllVisits.js
 */

const mongoose = require('mongoose');
const config = require('../config');
const VisitTarget = require('../database/models/VisitTarget');

const deleteAllVisits = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    // Count visits before deletion
    const countBefore = await VisitTarget.countDocuments();
    console.log(`📊 Total visits before deletion: ${countBefore}`);

    if (countBefore === 0) {
      console.log('ℹ️  No visits to delete.');
      await mongoose.connection.close();
      return;
    }

    // Delete all visits
    const result = await VisitTarget.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} visits successfully.`);

    // Verify deletion
    const countAfter = await VisitTarget.countDocuments();
    console.log(`📊 Total visits after deletion: ${countAfter}`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error deleting visits:', error);
    process.exit(1);
  }
};

// Run the script
deleteAllVisits();
