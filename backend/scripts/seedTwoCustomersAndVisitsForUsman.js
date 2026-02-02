/**
 * Create 2 new customers (different Karachi locations) and 2 visit targets
 * assigned to salesman usman.abid00321@gmail.com
 *
 * Usage:
 *   node scripts/seedTwoCustomersAndVisitsForUsman.js
 */

const mongoose = require("mongoose");
const connectDB = require("../database/connection");
const Customer = require("../database/models/Customer");
const VisitTarget = require("../database/models/VisitTarget");
const User = require("../database/models/User");

const SALESMAN_EMAIL = "usman.abid00321@gmail.com";

async function main() {
  await connectDB();

  try {
    const admin = await User.findOne({ role: "admin" })
      .select("_id name email")
      .lean();
    if (!admin) {
      console.log("❌ No admin user found.");
      process.exit(1);
    }

    const salesman = await User.findOne({
      role: "salesman",
      email: SALESMAN_EMAIL,
    }).select("_id name email");
    if (!salesman) {
      console.log("❌ Salesman not found with email:", SALESMAN_EMAIL);
      process.exit(1);
    }

    console.log("✅ Admin:", admin.email);
    console.log(
      "✅ Salesman:",
      salesman.name || salesman.email,
      `(${salesman.email})`
    );

    // Two customers – different Karachi locations
    const customersData = [
      {
        firstName: "Customer Karachi One",
        name: "Customer Karachi One",
        address: "Block 5 Clifton, Karachi",
        city: "Karachi",
        state: "Sindh",
        pincode: "75600",
        postcode: "75600",
        latitude: 24.8144,
        longitude: 67.0312,
        email: "customer.karachi1@example.com",
        phone: "+923001234501",
        status: "Not Visited",
        createdBy: admin._id,
        source: "app",
      },
      {
        firstName: "Customer Karachi Two",
        name: "Customer Karachi Two",
        address: "Gulshan-e-Iqbal Block 13, Karachi",
        city: "Karachi",
        state: "Sindh",
        pincode: "75300",
        postcode: "75300",
        latitude: 24.8945,
        longitude: 67.0822,
        email: "customer.karachi2@example.com",
        phone: "+923001234502",
        status: "Not Visited",
        createdBy: admin._id,
        source: "app",
      },
    ];

    const createdCustomers = [];
    for (const data of customersData) {
      const customer = await Customer.create(data);
      createdCustomers.push(customer);
      console.log(
        "   Created customer:",
        customer.firstName,
        `(${customer.latitude}, ${customer.longitude})`
      );
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    for (let i = 0; i < createdCustomers.length; i++) {
      const c = createdCustomers[i];
      const visitTargetData = {
        name: c.firstName,
        description: `Visit: ${c.address || c.city}`,
        salesman: salesman._id,
        createdBy: admin._id,
        latitude: c.latitude,
        longitude: c.longitude,
        address: c.address,
        city: c.city,
        state: c.state,
        pincode: c.pincode || c.postcode,
        customerName: c.firstName,
        customerId: c._id,
        visitDate: tomorrow,
        status: "Pending",
        approvalStatus: "Approved",
        approvedAt: new Date(),
        approvedBy: admin._id,
      };
      const vt = await VisitTarget.create(visitTargetData);
      console.log("   Created visit target:", vt.name, "for", c.firstName);
    }

    console.log(
      "✅ Done. Created 2 customers and 2 visit targets for",
      salesman.email
    );
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
