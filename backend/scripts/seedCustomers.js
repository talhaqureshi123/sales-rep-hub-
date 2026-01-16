const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const Customer = require('../database/models/Customer');
const User = require('../database/models/User');

// Sample customers data
const customers = [
  {
    name: 'ABC Corporation',
    email: 'contact@abccorp.com',
    phone: '+1234567890',
    address: '123 Business Street',
    city: 'London',
    state: 'England',
    pincode: 'SW1A 1AA',
    company: 'ABC Corporation',
    status: 'Active',
    notes: 'Premium customer with high order volume',
  },
  {
    name: 'XYZ Industries Ltd',
    email: 'info@xyzindustries.com',
    phone: '+1234567891',
    address: '456 Industrial Avenue',
    city: 'Manchester',
    state: 'England',
    pincode: 'M1 1AA',
    company: 'XYZ Industries Ltd',
    status: 'Active',
    notes: 'Regular customer, monthly orders',
  },
  {
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1234567892',
    address: '789 Residential Road',
    city: 'Birmingham',
    state: 'England',
    pincode: 'B1 1AA',
    company: 'Smith Trading',
    status: 'Active',
    notes: 'Individual customer',
  },
  {
    name: 'Tech Solutions Inc',
    email: 'sales@techsolutions.com',
    phone: '+1234567893',
    address: '321 Tech Park',
    city: 'Leeds',
    state: 'England',
    pincode: 'LS1 1AA',
    company: 'Tech Solutions Inc',
    status: 'Active',
    notes: 'Technology company, bulk orders',
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '+1234567894',
    address: '654 Main Street',
    city: 'Liverpool',
    state: 'England',
    pincode: 'L1 1AA',
    company: 'Johnson & Co',
    status: 'Active',
    notes: 'Small business owner',
  },
  {
    name: 'Global Trading Co',
    email: 'contact@globaltrading.com',
    phone: '+1234567895',
    address: '987 Trade Center',
    city: 'Bristol',
    state: 'England',
    pincode: 'BS1 1AA',
    company: 'Global Trading Co',
    status: 'Active',
    notes: 'International trading company',
  },
  {
    name: 'Mike Williams',
    email: 'mike.williams@email.com',
    phone: '+1234567896',
    address: '147 Oak Lane',
    city: 'Sheffield',
    state: 'England',
    pincode: 'S1 1AA',
    company: 'Williams Enterprises',
    status: 'Active',
    notes: 'Local business',
  },
  {
    name: 'Premium Retail Ltd',
    email: 'info@premiumretail.com',
    phone: '+1234567897',
    address: '258 Retail Plaza',
    city: 'Newcastle',
    state: 'England',
    pincode: 'NE1 1AA',
    company: 'Premium Retail Ltd',
    status: 'Active',
    notes: 'Retail chain, multiple locations',
  },
  {
    name: 'David Brown',
    email: 'david.brown@email.com',
    phone: '+1234567898',
    address: '369 Garden Street',
    city: 'Nottingham',
    state: 'England',
    pincode: 'NG1 1AA',
    company: 'Brown & Associates',
    status: 'Active',
    notes: 'Consulting firm',
  },
  {
    name: 'Modern Manufacturing',
    email: 'sales@modernmfg.com',
    phone: '+1234567899',
    address: '741 Factory Road',
    city: 'Coventry',
    state: 'England',
    pincode: 'CV1 1AA',
    company: 'Modern Manufacturing',
    status: 'Active',
    notes: 'Manufacturing company',
  },
];

const seedCustomers = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to MongoDB');

    // Get admin user (for createdBy field)
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('Error: No admin user found. Please run seedUsers.js first.');
      process.exit(1);
    }

    // Get all salesmen
    const salesmen = await User.find({ role: 'salesman', status: 'Active' });
    if (salesmen.length === 0) {
      console.log('Warning: No salesmen found. Customers will be created without assignment.');
    }

    console.log(`Found ${salesmen.length} salesmen`);

    // Clear existing customers (optional - comment out if you want to keep existing)
    // await Customer.deleteMany({});
    // console.log('Cleared existing customers');

    // Create customers
    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < customers.length; i++) {
      const customerData = customers[i];
      
      // Check if customer already exists (by email or name)
      const existing = await Customer.findOne({
        $or: [
          { email: customerData.email },
          { name: customerData.name, company: customerData.company }
        ]
      });

      if (existing) {
        console.log(`Skipped: Customer "${customerData.name}" already exists`);
        skippedCount++;
        continue;
      }

      // Assign to salesman (round-robin if salesmen exist)
      let assignedSalesman = null;
      if (salesmen.length > 0) {
        const salesmanIndex = i % salesmen.length;
        assignedSalesman = salesmen[salesmanIndex]._id;
      }

      const customer = await Customer.create({
        ...customerData,
        assignedSalesman: assignedSalesman,
        createdBy: admin._id,
      });

      createdCount++;
      console.log(`Created customer: ${customer.name}${assignedSalesman ? ` (Assigned to: ${salesmen.find(s => s._id.toString() === assignedSalesman.toString())?.name})` : ''}`);
    }

    console.log('\n=== Seeding Summary ===');
    console.log(`Total customers in script: ${customers.length}`);
    console.log(`Created: ${createdCount}`);
    console.log(`Skipped (already exist): ${skippedCount}`);
    console.log('Customer seeding completed!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding customers:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedCustomers();
}

module.exports = seedCustomers;


