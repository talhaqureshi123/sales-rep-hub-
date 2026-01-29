/**
 * Clear All Test Data – Salesman + Admin dono DB ek saath khali
 *
 * Testing ke liye: Ek hi script se salesman aur admin dono ka data clear.
 *
 * Usage:
 *   node scripts/clearAllTestData.js --confirm          → Dono (salesman + admin) clear
 *   node scripts/clearAllTestData.js --confirm --salesman  → Sirf salesman data
 *   node scripts/clearAllTestData.js --confirm --admin     → Sirf admin data
 *
 * Bina --confirm ke delete nahi hoga (safety).
 */

const connectDB = require('../database/connection');
const Customer = require('../database/models/Customer');
const SalesOrder = require('../database/models/SalesOrder');
const SalesTarget = require('../database/models/SalesTarget');
const VisitTarget = require('../database/models/VisitTarget');
const FollowUp = require('../database/models/FollowUp');
const Sample = require('../database/models/Sample');
const Quotation = require('../database/models/Quotation');
const Tracking = require('../database/models/Tracking');
const ShiftPhoto = require('../database/models/ShiftPhoto');
const HubSpotOAuthToken = require('../database/models/HubSpotOAuthToken');
const Location = require('../database/models/Location');
const Milestone = require('../database/models/Milestone');
const Product = require('../database/models/Product');
const ProductVideo = require('../database/models/ProductVideo');

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

const ADMIN_COLLECTIONS = [
  { name: 'Customer', model: Customer },
  { name: 'SalesOrder', model: SalesOrder },
  { name: 'SalesTarget', model: SalesTarget },
  { name: 'VisitTarget', model: VisitTarget },
  { name: 'FollowUp (Tasks)', model: FollowUp },
  { name: 'Sample', model: Sample },
  { name: 'Quotation', model: Quotation },
  { name: 'Tracking', model: Tracking },
  { name: 'ShiftPhoto', model: ShiftPhoto },
  { name: 'HubSpotOAuthToken', model: HubSpotOAuthToken },
  { name: 'Location', model: Location },
  { name: 'Milestone', model: Milestone },
  { name: 'Product', model: Product },
  { name: 'ProductVideo', model: ProductVideo },
];

async function clearCollections(collections) {
  let totalDeleted = 0;
  const seen = new Set();
  for (const { name, model } of collections) {
    const key = model.modelName || name;
    if (seen.has(key)) continue;
    seen.add(key);
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
  return totalDeleted;
}

async function main() {
  const confirmed = process.argv.includes('--confirm');
  const salesmanOnly = process.argv.includes('--salesman');
  const adminOnly = process.argv.includes('--admin');

  log('\n' + '='.repeat(70), 'blue');
  log('🗑️  Clear All Test Data – Salesman + Admin', 'magenta');
  log('='.repeat(70) + '\n', 'blue');

  if (!confirmed) {
    logWarning('Safety: Bina --confirm ke delete nahi hoga.');
    logInfo('Usage:');
    logInfo('  node scripts/clearAllTestData.js --confirm              (dono clear)');
    logInfo('  node scripts/clearAllTestData.js --confirm --salesman   (sirf salesman)');
    logInfo('  node scripts/clearAllTestData.js --confirm --admin      (sirf admin)\n');
    process.exit(1);
  }

  const doSalesman = !adminOnly;
  const doAdmin = !salesmanOnly;

  try {
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected.\n');

    let grandTotal = 0;

    if (doSalesman) {
      log('='.repeat(70), 'blue');
      log('👤 SALESMAN DATA', 'magenta');
      log('='.repeat(70), 'blue');
      const n = await clearCollections(SALESMAN_COLLECTIONS, 'Salesman');
      grandTotal += n;
      logSuccess(`Salesman total deleted: ${n}\n`);
    }

    if (doAdmin) {
      log('='.repeat(70), 'blue');
      log('👑 ADMIN DATA', 'magenta');
      log('='.repeat(70), 'blue');
      const n = await clearCollections(ADMIN_COLLECTIONS, 'Admin');
      grandTotal += n;
      logSuccess(`Admin total deleted: ${n}\n`);
    }

    log('='.repeat(70), 'blue');
    log('📊 Summary', 'magenta');
    log('='.repeat(70), 'blue');
    logSuccess(`Total documents removed: ${grandTotal}`);
    logInfo('Users intact – login kar sakte hain.');
    log('='.repeat(70) + '\n', 'green');
    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    console.error(error);
    process.exit(1);
  }
}

main();
