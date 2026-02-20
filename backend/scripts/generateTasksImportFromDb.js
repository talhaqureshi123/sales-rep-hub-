/**
 * Generate tasks-import-template.csv using first salesman from database.
 * Run after listSalesmen.js to use a real salesman email in the template.
 *
 * Usage: node scripts/generateTasksImportFromDb.js
 */

const fs = require("fs");
const path = require("path");
const connectDB = require("../database/connection");
const User = require("../database/models/User");

const TASK_TYPES = [
  "Call",
  "Visit",
  "Email",
  "Meeting",
  "WhatsApp",
  "Other",
  "Quote Follow-up",
  "Sample Feedback",
  "Order Check",
];

const run = async () => {
  try {
    await connectDB();
    const salesman = await User.findOne({ role: "salesman" })
      .select("email name")
      .lean();
    if (!salesman) {
      console.log("No salesman in database. Run seedUsers.js or create a salesman first.");
      process.exit(1);
    }
    const email = salesman.email;
    const baseDate = new Date();
    const header =
      "customerName,salesmanEmail,dueDate,type,priority,description,customerEmail,customerPhone,notes";
    const rows = TASK_TYPES.map((type, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i + 1);
      const dateStr = d.toISOString().slice(0, 10);
      const customer = `Customer ${type.replace(/-/g, " ")}`;
      const desc = `Task: ${type}`;
      return `${customer},${email},${dateStr},${type},Medium,${desc},,,`;
    });
    const csv = [header, ...rows].join("\n");
    const outPath = path.join(__dirname, "../../import-templates/tasks-import-template.csv");
    fs.writeFileSync(outPath, csv, "utf8");
    console.log(`\n✅ Written: import-templates/tasks-import-template.csv`);
    console.log(`   Salesman used: ${email} (${salesman.name})`);
    console.log(`   Rows: ${TASK_TYPES.length} (all task types).\n`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
};

run();
