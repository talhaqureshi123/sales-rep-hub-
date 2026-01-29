/**
 * Clear Salesman Data – Salesman database pura khali
 *
 * Ye script salesman-related sab collections clear karti hai:
 *   FollowUp (Tasks), VisitTarget, Sample, SalesTarget,
 *   Tracking, ShiftPhoto, Quotation
 *
 * Usage:
 *   node scripts/clearSalesmanData.js --confirm
 *
 * Bina --confirm ke script run nahi hogi (safety).
 */

const connectDB = require('../database/connection');
const FollowUp = require('../database/models/FollowUp');
const VisitTarget = require('../database/models/VisitTarget');
const Sample = require('../database/models/Sample');
const SalesTarget = require('../database/models/SalesTarget');
const Tracking = require('../database/models/Tracking');
const ShiftPhoto = require('../database/models/ShiftPhoto');
const Quotation = require('../database/models/Quotation');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message, error = null) {
  log(`❌ ${message}`, 'red');
  if (error) log(`   Error: ${error.message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

const SALESMAN_COLLECTIONS = [
  { name: 'FollowUp (Tasks)', model: FollowUp },
  { name: 'VisitTarget', model: VisitTarget },
  { name: 'Sample', model: Sample },
  { name: 'SalesTarget', model: SalesTarget },
  { name: 'Tracking', model: Tracking },
  { name: 'ShiftPhoto', model: ShiftPhoto },
  { name: 'Quotation', model: Quotation },
];

async function main() {
  const confirmed = process.argv.includes('--confirm');

  log('\n' + '='.repeat(70), 'blue');
  log('🗑️  Clear Salesman Data – Salesman DB pura khali', 'magenta');
  log('='.repeat(70) + '\n', 'blue');

  if (!confirmed) {
    logWarning('Safety: Bina --confirm ke delete nahi hoga.');
    logInfo('Usage: node scripts/clearSalesmanData.js --confirm\n');
    process.exit(1);
  }

  try {
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected.\n');

    let totalDeleted = 0;

    for (const { name, model } of SALESMAN_COLLECTIONS) {
      log('-'.repeat(70), 'cyan');
      log(`📋 ${name}`, 'cyan');
      const count = await model.countDocuments();
      logInfo(`Documents: ${count}`);
      if (count > 0) {
        const result = await model.deleteMany({});
        totalDeleted += result.deletedCount;
        logSuccess(`Deleted ${result.deletedCount}`);
      } else {
        logInfo('Already empty.');
      }
      log('');
    }

    log('='.repeat(70), 'blue');
    log('📊 Summary', 'magenta');
    log('='.repeat(70), 'blue');
    logSuccess(`Salesman data cleared. Total documents removed: ${totalDeleted}`);
    log('='.repeat(70) + '\n', 'green');
    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    console.error(error);
    process.exit(1);
  }
}

main();
