/**
 * Clear Admin Data – Admin database pura khali
 *
 * Ye script admin / business sab collections clear karti hai
 * (Users nahi – taaki admin login kar sake):
 *   Customer, SalesOrder, SalesTarget, VisitTarget, FollowUp,
 *   Sample, Quotation, Tracking, ShiftPhoto, HubSpotOAuthToken,
 *   Location, Milestone, Product, ProductVideo
 *
 * Usage:
 *   node scripts/clearAdminData.js --confirm
 *
 * Bina --confirm ke script run nahi hogi (safety).
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

async function main() {
  const confirmed = process.argv.includes('--confirm');

  log('\n' + '='.repeat(70), 'blue');
  log('🗑️  Clear Admin Data – Admin DB pura khali', 'magenta');
  log('='.repeat(70) + '\n', 'blue');

  if (!confirmed) {
    logWarning('Safety: Bina --confirm ke delete nahi hoga.');
    logInfo('Usage: node scripts/clearAdminData.js --confirm\n');
    process.exit(1);
  }

  try {
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected.\n');

    let totalDeleted = 0;

    for (const { name, model } of ADMIN_COLLECTIONS) {
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
    logSuccess(`Admin data cleared. Total documents removed: ${totalDeleted}`);
    logInfo('Users collection intact – admin/salesman login kar sakte hain.');
    log('='.repeat(70) + '\n', 'green');
    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    console.error(error);
    process.exit(1);
  }
}

main();
