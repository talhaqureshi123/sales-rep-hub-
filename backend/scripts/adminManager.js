const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const User = require('../database/models/User');

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0]; // 'create' or 'remove'
const email = args[1]; // Email address

// Admin data
const adminData = {
  name: 'Admin User',
  email: email || 'talhaabid400@gmail.com',
  password: 'Admin@123', // Default password - change this
  role: 'admin',
  status: 'Active',
  phone: '+923001234567',
  address: 'Admin Office',
};

const createAdmin = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    
    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log(`⚠️  Admin with email ${adminData.email} already exists!`);
        console.log(`   Name: ${existingAdmin.name}`);
        console.log(`   Role: ${existingAdmin.role}`);
        console.log(`   Status: ${existingAdmin.status}`);
        process.exit(0);
      } else {
        // Update existing user to admin
        existingAdmin.role = 'admin';
        existingAdmin.name = adminData.name;
        existingAdmin.status = 'Active';
        if (adminData.phone) existingAdmin.phone = adminData.phone;
        if (adminData.address) existingAdmin.address = adminData.address;
        await existingAdmin.save();
        console.log(`✅ Updated user ${adminData.email} to Admin role!`);
        console.log(`\n📝 Login Credentials:`);
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Password: ${existingAdmin.password ? 'Use existing password' : adminData.password}`);
        process.exit(0);
      }
    }

    // Create new admin
    const admin = new User(adminData);
    await admin.save();

    console.log(`✅ Admin created successfully!`);
    console.log(`\n📝 Admin Details:`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Status: ${admin.status}`);
    console.log(`\n🔐 Login Credentials:`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${adminData.password}`);
    console.log(`\n⚠️  Please change the password after first login!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

const removeAdmin = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    if (!email) {
      console.error('❌ Error: Please provide email address');
      console.log('Usage: node adminManager.js remove <email>');
      process.exit(1);
    }

    // Find admin by email
    const admin = await User.findOne({ email: email, role: 'admin' });
    
    if (!admin) {
      console.log(`⚠️  No admin found with email: ${email}`);
      process.exit(0);
    }

    // Check if this is the last admin
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 1) {
      console.error('❌ Error: Cannot remove the last admin!');
      console.log('   At least one admin must exist in the system.');
      process.exit(1);
    }

    // Remove admin
    await User.deleteOne({ _id: admin._id });
    
    console.log(`✅ Admin removed successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${admin.name}`);

    // Show remaining admins
    const remainingAdmins = await User.find({ role: 'admin' }).select('name email');
    console.log(`\n📊 Remaining Admins (${remainingAdmins.length}):`);
    remainingAdmins.forEach((a, index) => {
      console.log(`   ${index + 1}. ${a.name} (${a.email})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error removing admin:', error.message);
    process.exit(1);
  }
};

const listAdmins = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    const admins = await User.find({ role: 'admin' }).select('name email status phone createdAt');
    
    if (admins.length === 0) {
      console.log('⚠️  No admins found in the system.');
      process.exit(0);
    }

    console.log(`📊 Total Admins: ${admins.length}\n`);
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Status: ${admin.status}`);
      if (admin.phone) console.log(`   Phone: ${admin.phone}`);
      console.log(`   Created: ${new Date(admin.createdAt).toLocaleDateString()}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error listing admins:', error.message);
    process.exit(1);
  }
};

// Main execution
if (command === 'create') {
  if (email) {
    adminData.email = email;
  }
  createAdmin();
} else if (command === 'remove') {
  removeAdmin();
} else if (command === 'list') {
  listAdmins();
} else {
  console.log('📋 Admin Manager - Usage Guide\n');
  console.log('Commands:');
  console.log('  create [email]  - Create a new admin (default: talhaabid400@gmail.com)');
  console.log('  remove <email>  - Remove an admin by email');
  console.log('  list            - List all admins\n');
  console.log('Examples:');
  console.log('  node adminManager.js create');
  console.log('  node adminManager.js create talhaabid400@gmail.com');
  console.log('  node adminManager.js remove admin@example.com');
  console.log('  node adminManager.js list\n');
  process.exit(0);
}
