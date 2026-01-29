/**
 * Sare Tasks Delete – Saari tasks (FollowUp) DB se delete
 *
 * Usage:
 *   node scripts/deleteAllTasksWithConfirm.js --confirm
 *
 * Bina --confirm ke script run nahi hogi (safety).
 * Optional: --visits  → Saari VisitTargets bhi delete (visits list bhi clean)
 *
 * Run from backend folder:  node scripts/deleteAllTasksWithConfirm.js --confirm
 * Run from scripts folder:  node deleteAllTasksWithConfirm.js --confirm
 */

const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const VisitTarget = require('../database/models/VisitTarget');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSuccess(msg) {
  log(`✅ ${msg}`, 'green');
}

function logError(msg) {
  log(`❌ ${msg}`, 'red');
}

function logInfo(msg) {
  log(`ℹ ${msg}`, 'cyan');
}

function logWarning(msg) {
  log(`⚠ ${msg}`, 'yellow');
}

async function run() {
  const hasConfirm = process.argv.includes('--confirm');
  const withVisits = process.argv.includes('--visits');

  if (!hasConfirm) {
    logWarning('Safety: bina --confirm ke delete nahi hoga.');
    console.log('\nUsage:');
    console.log('  node deleteAllTasksWithConfirm.js --confirm');
    console.log('  node deleteAllTasksWithConfirm.js --confirm --visits   (tasks + visits dono delete)\n');
    process.exit(1);
  }

  await connectDB();

  const taskCount = await FollowUp.countDocuments();
  const visitCount = await VisitTarget.countDocuments();

  logInfo(`Tasks (FollowUp): ${taskCount}`);
  if (withVisits) logInfo(`VisitTargets: ${visitCount}`);

  if (taskCount === 0 && (!withVisits || visitCount === 0)) {
    logSuccess('Kuch delete karne ko nahi – already clean.');
    process.exit(0);
  }

  if (taskCount > 0) {
    const result = await FollowUp.deleteMany({});
    logSuccess(`Tasks deleted: ${result.deletedCount}`);
  }

  if (withVisits && visitCount > 0) {
    const result = await VisitTarget.deleteMany({});
    logSuccess(`VisitTargets deleted: ${result.deletedCount}`);
  }

  log('');
  logSuccess('Sare tasks delete ho gaye.');
  if (withVisits) logSuccess('Visits bhi delete ho gaye.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
