/**
 * Generate one tasks-import CSV per salesman in DB.
 * Uses real CUSTOMERS from DB + real SALESMEN from DB (for task import testing).
 * Files saved in import-templates/ as tasks-import-1-Name.csv, ...
 *
 * Usage: node scripts/generateTasksImportPerSalesman.js
 */

const fs = require("fs");
const path = require("path");
const connectDB = require("../database/connection");
const User = require("../database/models/User");
const Customer = require("../database/models/Customer");

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

function safeFileName(name) {
  return (name || "salesman").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

function csvVal(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const run = async () => {
  try {
    await connectDB();

    const salesmen = await User.find({ role: "salesman" })
      .select("email name")
      .sort({ email: 1 })
      .lean();
    if (!salesmen.length) {
      console.log("No salesman in database. Run seedUsers.js or create a salesman first.");
      process.exit(1);
    }

    const customers = await Customer.find({})
      .select("firstName name email phone")
      .limit(50)
      .lean();
    const customerList = customers.map((c) => ({
      customerName: (c.firstName || c.name || "Customer").trim(),
      customerEmail: (c.email || "").trim(),
      customerPhone: (c.phone || "").trim(),
    }));
    if (customerList.length === 0) {
      console.log("No customers in DB. Pehle customers import karein (customers-import-template.csv) ya add karein.");
      process.exit(1);
    }

    const outDir = path.join(__dirname, "../../import-templates");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const baseDate = new Date();
    const header =
      "customerName,salesmanEmail,dueDate,type,priority,description,customerEmail,customerPhone,notes";
    const created = [];

    for (let i = 0; i < salesmen.length; i++) {
      const s = salesmen[i];
      const salesmanEmail = s.email;
      const rows = TASK_TYPES.map((type, j) => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + j + 1);
        const dateStr = d.toISOString().slice(0, 10);
        const cust = customerList[j % customerList.length];
        const desc = `Task: ${type}`;
        return [
          csvVal(cust.customerName),
          csvVal(salesmanEmail),
          dateStr,
          type,
          "Medium",
          csvVal(desc),
          csvVal(cust.customerEmail),
          csvVal(cust.customerPhone),
          "",
        ].join(",");
      });
      const csv = [header, ...rows].join("\n");
      const safeName = safeFileName(s.name);
      const fileName = `tasks-import-${i + 1}-${safeName}.csv`;
      const outPath = path.join(outDir, fileName);
      fs.writeFileSync(outPath, csv, "utf8");
      created.push({ file: fileName, email: salesmanEmail, name: s.name });
    }

    console.log("\n✅ Tasks import CSV (DB se salesmen + customers):\n");
    console.log(`   Customers used: ${customerList.length} from DB`);
    created.forEach((c) => console.log(`   ${c.file}  →  ${c.email} (${c.name})`));
    console.log("\n   Import: Admin → Tasks → Import Excel → file select karein.\n");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
};

run();
