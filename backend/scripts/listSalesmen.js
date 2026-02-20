/**
 * List all salesmen from database (email, name, id).
 * Use this to get salesman emails for Tasks import template.
 *
 * Usage: node scripts/listSalesmen.js
 */

const connectDB = require("../database/connection");
const User = require("../database/models/User");

const run = async () => {
  try {
    await connectDB();
    const salesmen = await User.find({ role: "salesman" })
      .select("_id name email status")
      .sort({ email: 1 })
      .lean();
    console.log("\n📋 Salesmen in database:\n");
    if (!salesmen.length) {
      console.log("   No salesman found. Create users with role 'salesman' first (e.g. run seedUsers.js).\n");
      process.exit(0);
      return;
    }
    salesmen.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.email}  (${s.name})  [${s.status}]  id: ${s._id}`);
    });
    console.log("\n   Use any of the above emails in tasks-import-template.csv as salesmanEmail.\n");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
};

run();
