/**
 * Create 5 customers (5 different locations) and 5 visit targets for TOMORROW.
 * Assigns to first available salesman.
 *
 * Usage: node scripts/seedFiveVisitsTomorrow.js
 */

const mongoose = require("mongoose");
const connectDB = require("../database/connection");
const Customer = require("../database/models/Customer");
const VisitTarget = require("../database/models/VisitTarget");
const User = require("../database/models/User");

// 5 different locations – Karachi (distinct lat/long)
const LOCATIONS = [
  {
    name: "Tomorrow Visit One",
    address: "Block 5 Clifton, Karachi",
    city: "Karachi",
    state: "Sindh",
    pincode: "75600",
    latitude: 24.8144,
    longitude: 67.0312,
    email: "tomorrow.visit1@example.com",
    phone: "+923001234521",
  },
  {
    name: "Tomorrow Visit Two",
    address: "Gulshan-e-Iqbal Block 13, Karachi",
    city: "Karachi",
    state: "Sindh",
    pincode: "75300",
    latitude: 24.8945,
    longitude: 67.0822,
    email: "tomorrow.visit2@example.com",
    phone: "+923001234522",
  },
  {
    name: "Tomorrow Visit Three",
    address: "DHA Phase 5, Karachi",
    city: "Karachi",
    state: "Sindh",
    pincode: "75500",
    latitude: 24.8002,
    longitude: 67.0574,
    email: "tomorrow.visit3@example.com",
    phone: "+923001234523",
  },
  {
    name: "Tomorrow Visit Four",
    address: "North Nazimabad Block L, Karachi",
    city: "Karachi",
    state: "Sindh",
    pincode: "74700",
    latitude: 24.9352,
    longitude: 67.0301,
    email: "tomorrow.visit4@example.com",
    phone: "+923001234524",
  },
  {
    name: "Tomorrow Visit Five",
    address: "Korangi Industrial Area, Karachi",
    city: "Karachi",
    state: "Sindh",
    pincode: "74900",
    latitude: 24.7823,
    longitude: 67.0934,
    email: "tomorrow.visit5@example.com",
    phone: "+923001234525",
  },
];

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

    const salesman = await User.findOne({ role: "salesman" }).select(
      "_id name email"
    );
    if (!salesman) {
      console.log(
        "❌ No salesman user found. Create a salesman and run again."
      );
      process.exit(1);
    }

    console.log("✅ Admin:", admin.email);
    console.log(
      "✅ Salesman:",
      salesman.name || salesman.email,
      `(${salesman.email})`
    );

    // Tomorrow 9:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const visitDateTomorrow = new Date(tomorrow);
    visitDateTomorrow.setHours(9, 0, 0, 0);

    console.log("\n📌 Creating 5 customers (5 different locations)…");

    const createdCustomers = [];
    for (let i = 0; i < LOCATIONS.length; i++) {
      const loc = LOCATIONS[i];
      const customer = await Customer.create({
        firstName: loc.name,
        name: loc.name,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        pincode: loc.pincode,
        postcode: loc.pincode,
        latitude: loc.latitude,
        longitude: loc.longitude,
        email: loc.email,
        phone: loc.phone,
        status: "Not Visited",
        createdBy: admin._id,
        source: "app",
      });
      createdCustomers.push(customer);
      console.log(
        `   ${i + 1}. ${customer.name} – ${loc.address} (${loc.latitude}, ${
          loc.longitude
        })`
      );
    }

    console.log("\n📌 Creating 5 visit targets for TOMORROW…");

    for (let i = 0; i < createdCustomers.length; i++) {
      const c = createdCustomers[i];
      const visitTargetData = {
        name: c.firstName,
        description: `Tomorrow visit ${i + 1}: ${c.address || c.city}`,
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
        visitDate: visitDateTomorrow,
        status: "Pending",
        approvalStatus: "Approved",
        approvedAt: new Date(),
        approvedBy: admin._id,
      };
      const vt = await VisitTarget.create(visitTargetData);
      console.log(`   ${i + 1}. ${vt.name} – ${c.address}`);
    }

    const dateStr = visitDateTomorrow.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    console.log("\n✅ Done.");
    console.log("   – 5 customers created (5 different locations)");
    console.log("   – 5 visit targets for TOMORROW (" + dateStr + ") assigned to", salesman.email);
    console.log(
      "   – Test flow: Sales Tracking → select visit → Complete → next → … → End shift"
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
