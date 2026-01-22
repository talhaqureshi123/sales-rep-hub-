/**
 * Script to delete all customers from the database
 * Usage: node backend/scripts/deleteAllCustomers.js
 */

const mongoose = require('mongoose');
const config = require('../config');
const Customer = require('../database/models/Customer');

const deleteAllCustomers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    // Count customers before deletion
    const countBefore = await Customer.countDocuments();
    console.log(`📊 Total customers before deletion: ${countBefore}`);

    if (countBefore === 0) {
      console.log('ℹ️  No customers to delete.');
      await mongoose.connection.close();
      return;
    }

    // Delete all customers
    const result = await Customer.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} customers successfully.`);

    // Verify deletion
    const countAfter = await Customer.countDocuments();
    console.log(`📊 Total customers after deletion: ${countAfter}`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error deleting customers:', error);
    process.exit(1);
  }
};

// Run the script
deleteAllCustomers();
