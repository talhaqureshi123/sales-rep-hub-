const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const User = require('../database/models/User');

// Sample users data
const users = [
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
    status: 'Active',
    phone: '+1234567890',
    address: 'Admin Office, Main Street',
  },
  {
    name: 'Salesman 1',
    email: 'salesman@example.com',
    password: 'salesman123',
    role: 'salesman',
    status: 'Active',
    phone: '+1234567891',
    address: 'Sales Office, First Avenue',
  },
  {
    name: 'John Salesman',
    email: 'john.salesman@example.com',
    password: 'john123',
    role: 'salesman',
    status: 'Active',
    phone: '+1234567892',
    address: '123 Sales Street, City',
  },
  {
    name: 'Sarah Salesman',
    email: 'sarah.salesman@example.com',
    password: 'sarah123',
    role: 'salesman',
    status: 'Active',
    phone: '+1234567893',
    address: '456 Sales Avenue, City',
  },
];

const seedUsers = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to MongoDB');

    // Clear existing users (optional - comment out if you want to keep existing users)
    // await User.deleteMany({});
    // console.log('Cleared existing users');

    // Create users
    const createdUsers = [];
    for (const userData of users) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      
      if (existingUser) {
        console.log(`User with email ${userData.email} already exists. Skipping...`);
        continue;
      }

      // Create user using new User() and save() - password will be hashed automatically by the model's pre-save hook
      const user = new User(userData);
      await user.save();

      createdUsers.push(user);
      console.log(`✅ Created user: ${user.name} (${user.email}) - Role: ${user.role}`);
    }

    console.log('\n📊 Summary:');
    console.log(`Total users in database: ${await User.countDocuments()}`);
    console.log(`Admin users: ${await User.countDocuments({ role: 'admin' })}`);
    console.log(`Salesman users: ${await User.countDocuments({ role: 'salesman' })}`);
    console.log(`\n✅ Seeding completed successfully!`);
    console.log('\n📝 Default Login Credentials:');
    console.log('Admin:');
    console.log('  Email: admin@example.com');
    console.log('  Password: admin123');
    console.log('\nSalesman:');
    console.log('  Email: salesman@example.com');
    console.log('  Password: salesman123');
    console.log('\n  Email: john.salesman@example.com');
    console.log('  Password: john123');
    console.log('\n  Email: sarah.salesman@example.com');
    console.log('  Password: sarah123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
};

// Run the seed function
seedUsers();

