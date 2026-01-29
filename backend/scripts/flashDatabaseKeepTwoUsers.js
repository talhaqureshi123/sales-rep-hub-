/**
 * Flash Database – Sirf 2 users rakho, baaki sab delete
 *
 * KEEP:
 *   - 1 Admin (koi bhi ek admin)
 *   - 1 Salesman: usman.abid00321@gmail.com
 *
 * DELETE:
 *   - Saare doosre users
 *   - Saari related data: Customer, SalesOrder, VisitTarget, FollowUp, Sample,
 *     Quotation, SalesTarget, Tracking, ShiftPhoto, Location, Milestone,
 *     HubSpotOAuthToken, Product, ProductVideo
 *
 * Usage:
 *   node scripts/flashDatabaseKeepTwoUsers.js --confirm
 *
 * Bina --confirm ke delete nahi hoga (safety).
 */

const connectDB = require('../database/connection');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const SalesOrder = require('../database/models/SalesOrder');
const SalesTarget = require('../database/models/SalesTarget');
const VisitTarget = require('../database/models/VisitTarget');
const FollowUp = require('../database/models/FollowUp');
const Sample = require('../database/models/Sample');
const Quotation = require('../database/models/Quotation');
const Tracking = require('../database/models/Tracking');
const ShiftPhoto = require('../database/models/ShiftPhoto');
const Location = require('../database/models/Location');
const Milestone = require('../database/models/Milestone');
const HubSpotOAuthToken = require('../database/models/HubSpotOAuthToken');
const Product = require('../database/models/Product');
const ProductVideo = require('../database/models/ProductVideo');

const KEEP_SALESMAN_EMAIL = 'usman.abid00321@gmail.com';

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

// Collections to fully clear (all documents deleted)
const COLLECTIONS_TO_FLASH = [
  { name: 'Customer', model: Customer },
  { name: 'SalesOrder', model: SalesOrder },
  { name: 'SalesTarget', model: SalesTarget },
  { name: 'VisitTarget', model: VisitTarget },
  { name: 'FollowUp', model: FollowUp },
  { name: 'Sample', model: Sample },
  { name: 'Quotation', model: Quotation },
  { name: 'Tracking', model: Tracking },
  { name: 'ShiftPhoto', model: ShiftPhoto },
  { name: 'Location', model: Location },
  { name: 'Milestone', model: Milestone },
  { name: 'HubSpotOAuthToken', model: HubSpotOAuthToken },
  { name: 'Product', model: Product },
  { name: 'ProductVideo', model: ProductVideo },
];

async function clearCollection(model, name) {
  const count = await model.countDocuments();
  if (count === 0) return 0;
  const result = await model.deleteMany({});
  logSuccess(`${name}: deleted ${result.deletedCount}`);
  return result.deletedCount;
}

async function main() {
  const confirmed = process.argv.includes('--confirm');

  log('\n' + '='.repeat(70), 'blue');
  log('🗑️  Flash Database – Keep Only 1 Admin + Salesman (usman.abid00321@gmail.com)', 'magenta');
  log('='.repeat(70) + '\n', 'blue');

  if (!confirmed) {
    logWarning('Safety: Bina --confirm ke delete nahi hoga.');
    logInfo('Usage: node scripts/flashDatabaseKeepTwoUsers.js --confirm\n');
    process.exit(1);
  }

  try {
    logInfo('Connecting to database...');
    await connectDB();
    logSuccess('Database connected.\n');

    // 1) Find users to KEEP
    const admin = await User.findOne({ role: 'admin' }).select('_id name email role');
    const salesman = await User.findOne({ email: KEEP_SALESMAN_EMAIL }).select('_id name email role');

    if (!admin) {
      logError('Koi admin user nahi mila. Pehle ek admin create karo.');
      process.exit(1);
    }
    if (!salesman) {
      logError(`Salesman "${KEEP_SALESMAN_EMAIL}" nahi mila. DB mein ye email check karo.`);
      process.exit(1);
    }

    const keepIds = [admin._id.toString(), salesman._id.toString()];
    log('📌 KEEP (delete nahi karenge):', 'cyan');
    log(`   Admin:   ${admin.email} (${admin.name})`, 'cyan');
    log(`   Salesman: ${salesman.email} (${salesman.name})`, 'cyan');
    log('');

    // 2) Delete all other users
    const usersToDelete = await User.find({ _id: { $nin: [admin._id, salesman._id] } }).select('email role');
    const userDeleteCount = usersToDelete.length;
    if (userDeleteCount > 0) {
      await User.deleteMany({ _id: { $nin: [admin._id, salesman._id] } });
      logSuccess(`Users deleted: ${userDeleteCount} (sirf 2 bache: admin + ${KEEP_SALESMAN_EMAIL})`);
    } else {
      logInfo('Users: koi extra user nahi, sirf 2 hi the.');
    }
    log('');

    // 3) Flash all related collections (delete all documents)
    log('📋 Clearing all related data...', 'magenta');
    let totalDeleted = 0;
    const seen = new Set();
    for (const { name, model } of COLLECTIONS_TO_FLASH) {
      const key = model.modelName || name;
      if (seen.has(key)) continue;
      seen.add(key);
      const n = await clearCollection(model, name);
      totalDeleted += n;
    }

    log('\n' + '='.repeat(70), 'blue');
    log('📊 Summary', 'magenta');
    log('='.repeat(70), 'blue');
    logSuccess(`Total documents removed from collections: ${totalDeleted}`);
    logSuccess(`Users removed: ${userDeleteCount} (2 kept: 1 admin + 1 salesman)`);
    logInfo('Database flashed. Sirf 1 admin aur salesman (usman.abid00321@gmail.com) bache.');
    log('='.repeat(70) + '\n', 'green');
    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    console.error(error);
    process.exit(1);
  }
}

main();
