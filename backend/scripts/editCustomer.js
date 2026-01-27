const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const Customer = require('../database/models/Customer');

// Script to edit customer with associated contact, company, last contact, and last engagement
async function editCustomer() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');

    // Find customer by email or name
    const customerEmail = 'info@iotfiysolutions.com';
    const customerName = 'Jawwad Malik';

    let customer = await Customer.findOne({
      $or: [
        { email: customerEmail },
        { name: customerName },
        { firstName: customerName }
      ]
    });

    if (!customer) {
      console.log('Customer not found. Searching all customers...');
      const allCustomers = await Customer.find({}).limit(10);
      console.log('Available customers:');
      allCustomers.forEach(c => {
        console.log(`- ${c.name || c.firstName} (${c.email})`);
      });
      process.exit(1);
    }

    console.log(`Found customer: ${customer.name || customer.firstName} (${customer.email})`);

    // Update customer with new fields
    // You can modify these values as needed
    const updateData = {
      // Associated Contact
      associatedContactName: 'Usman abid', // Update with actual contact name
      
      // Associated Company
      associatedCompanyName: 'IoT Fiy Solutions', // Update with actual company name
      
      // Last Contact - Set to current date or specific date
      // Format: new Date('YYYY-MM-DD') or new Date() for current date
      lastContact: new Date(), // Update with actual last contact date
      
      // Last Engagement - Set to current date or specific date
      // Format: new Date('YYYY-MM-DD') or new Date() for current date
      lastEngagement: new Date(), // Update with actual last engagement date
      
      // Update timestamp
      updatedAt: new Date()
    };

    // Update customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customer._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log('\n✅ Customer updated successfully!');
    console.log('\nUpdated Customer Details:');
    console.log('========================');
    console.log(`Name: ${updatedCustomer.name || updatedCustomer.firstName}`);
    console.log(`Email: ${updatedCustomer.email}`);
    console.log(`Phone: ${updatedCustomer.phone}`);
    console.log(`Associated Contact Name: ${updatedCustomer.associatedContactName || 'Not set'}`);
    console.log(`Associated Company Name: ${updatedCustomer.associatedCompanyName || 'Not set'}`);
    console.log(`Last Contact: ${updatedCustomer.lastContact ? new Date(updatedCustomer.lastContact).toLocaleString('en-GB') : 'Not set'}`);
    console.log(`Last Engagement: ${updatedCustomer.lastEngagement ? new Date(updatedCustomer.lastEngagement).toLocaleString('en-GB') : 'Not set'}`);
    console.log('========================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating customer:', error);
    process.exit(1);
  }
}

// Run the script
editCustomer();
