/**
 * 1. Remove old test customers (Karachi One, Two) and their visit targets
 * 2. Create 5 new customers (different Karachi locations)
 * 3. Create 5 visit targets for TODAY – Usman (usman.abid00321@gmail.com)
 *    Flow: first target → next → next → … → end shift
 *
 * Usage: node scripts/resetAndSeedFiveTargetsToday.js
 */

const mongoose = require("mongoose");
const connectDB = require("../database/connection");
const Customer = require("../database/models/Customer");
const VisitTarget = require("../database/models/VisitTarget");
const User = require("../database/models/User");

const SALESMAN_EMAIL = "usman.abid00321@gmail.com";

const OLD_CUSTOMER_EMAILS = [
  "customer.karachi1@example.com",
  "customer.karachi2@example.com",
];

async function main() {
  await connectDB();

  try {
    const admin = await User.findOne({ role: "admin" }).select("_id name email").lean();
    if (!admin) {
      console.log("❌ No admin user found.");
      process.exit(1);
    }

    const salesman = await User.findOne({ role: "salesman", email: SALESMAN_EMAIL }).select("_id name email");
    if (!salesman) {
      console.log("❌ Salesman not found:", SALESMAN_EMAIL);
      process.exit(1);
    }

    console.log("Step 1: Remove old test customers and their visit targets…");

    const oldCustomers = await Customer.find({ email: { $in: OLD_CUSTOMER_EMAILS } }).select("_id firstName email");
    const oldCustomerIds = oldCustomers.map((c) => c._id);

    if (oldCustomerIds.length > 0) {
      const deletedVisits = await VisitTarget.deleteMany({ customerId: { $in: oldCustomerIds } });
      const deletedCustomers = await Customer.deleteMany({ _id: { $in: oldCustomerIds } });
      console.log("   Deleted visit targets:", deletedVisits.deletedCount);
      console.log("   Deleted customers:", deletedCustomers.deletedCount);
    } else {
      console.log("   No old test customers found (already removed).");
    }

    console.log("\nStep 2: Create 5 new customers (different Karachi locations)…");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const customersData = [
      {
        firstName: "Visit One Customer",
        name: "Visit One Customer",
        address: "Block 5 Clifton, Karachi",
        city: "Karachi",
        state: "Sindh",
        pincode: "75600",
        postcode: "75600",
        latitude: 24.8144,
        longitude: 67.0312,
        email: "visit1.customer@example.com",
        phone: "+923001234511",
        status: "Not Visited",
        createdBy: admin._id,
        source: "app",
      },
      {
        firstName: "Visit Two Customer",
        name: "Visit Two Customer",
        address: "Gulshan-e-Iqbal Block 13, Karachi",
        city: "Karachi",
        state: "Sindh",
        pincode: "75300",
        postcode: "75300",
        latitude: 24.8945,
        longitude: 67.0822,
        email: "visit2.customer@example.com",
        phone: "+923001234512",
        status: "Not Visited",
        createdBy: admin._id,
        source: "app",
      },
      {
        firstName: "Visit Three Customer",
        name: "Visit Three Customer",
        address: "DHA Phase 5, Karachi",
        city: "Karachi",
        state: "Sindh",
        pincode: "75500",
        postcode: "75500",
        latitude: 24.8002,
        longitude: 67.0574,
        email: "visit3.customer@example.com",
        phone: "+923001234513",
        status: "Not Visited",
        createdBy: admin._id,
        source: "app",
      },
      {
        firstName: "Visit Four Customer",
        name: "Visit Four Customer",
        address: "North Nazimabad Block L, Karachi",
        city: "Karachi",
        state: "Sindh",
        pincode: "74700",
        postcode: "74700",
        latitude: 24.9352,
        longitude: 67.0301,
        email: "visit4.customer@example.com",
        phone: "+923001234514",
        status: "Not Visited",
        createdBy: admin._id,
        source: "app",
      },
      {
        firstName: "Visit Five Customer",
        name: "Visit Five Customer",
        address: "Korangi Industrial Area, Karachi",
        city: "Karachi",
        state: "Sindh",
        pincode: "74900",
        postcode: "74900",
        latitude: 24.7823,
        longitude: 67.0934,
        email: "visit5.customer@example.com",
        phone: "+923001234515",
        status: "Not Visited",
        createdBy: admin._id,
        source: "app",
      },
    ];

    const createdCustomers = [];
    for (const data of customersData) {
      const customer = await Customer.create(data);
      createdCustomers.push(customer);
      console.log("   Created:", customer.firstName, `(${customer.latitude}, ${customer.longitude})`);
    }

    console.log("\nStep 3: Create 5 visit targets for TODAY (first → next → … → end shift)…");

    const visitDateToday = new Date(today);
    visitDateToday.setHours(9, 0, 0, 0);

    for (let i = 0; i < createdCustomers.length; i++) {
      const c = createdCustomers[i];
      const visitTargetData = {
        name: c.firstName,
        description: `Visit ${i + 1}: ${c.address || c.city}`,
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
        visitDate: visitDateToday,
        status: "Pending",
        approvalStatus: "Approved",
        approvedAt: new Date(),
        approvedBy: admin._id,
      };
      const vt = await VisitTarget.create(visitTargetData);
      console.log("   Created visit target", i + 1 + "/5:", vt.name);
    }

    console.log("\n✅ Done.");
    console.log("   – Removed old test customers & their visits");
    console.log("   – 5 new customers created");
    console.log("   – 5 visit targets for TODAY assigned to", salesman.email);
    console.log("   – Sales tracking flow: first target → next → … → fifth → End shift");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
