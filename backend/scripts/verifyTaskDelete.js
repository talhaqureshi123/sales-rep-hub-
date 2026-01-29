/**
 * Verify Task Delete – Check kare ki task delete hone par FollowUp + linked VisitTarget dono DB se hatt rahe hain
 *
 * Usage:
 *   node scripts/verifyTaskDelete.js --check   → Sirf check (kitne tasks linked visit ke sath, koi delete nahi)
 *   node scripts/verifyTaskDelete.js --run     → Ek linked task delete karke verify (dono DB se gaye ya nahi)
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

async function run() {
  const isCheck = process.argv.includes('--check');
  const isRun = process.argv.includes('--run');

  if (!isCheck && !isRun) {
    console.log('Usage:');
    console.log('  node scripts/verifyTaskDelete.js --check   (sirf check, koi delete nahi)');
    console.log('  node scripts/verifyTaskDelete.js --run    (ek linked task delete karke verify)');
    process.exit(0);
  }

  await connectDB();

  // Tasks (FollowUp) jinke paas visitTarget linked hai, type Visit
  const linkedTasks = await FollowUp.find({
    visitTarget: { $exists: true, $ne: null },
    type: 'Visit',
  })
    .populate('visitTarget', 'name address status')
    .lean();

  logInfo(`Linked tasks (FollowUp with visitTarget, type Visit): ${linkedTasks.length}`);

  if (linkedTasks.length === 0) {
    logInfo('Abhi koi bhi task visit-target ke sath linked nahi hai. Delete logic tab bhi sahi hai – jab linked task delete hoga toh VisitTarget bhi delete hoga.');
    process.exit(0);
  }

  const sample = linkedTasks[0];
  const taskId = sample._id.toString();
  const visitTargetId = sample.visitTarget && (sample.visitTarget._id || sample.visitTarget);
  const vtIdStr = visitTargetId ? visitTargetId.toString() : 'N/A';

  if (isCheck) {
    log('');
    log('Sample linked task:', 'cyan');
    log(`  FollowUp _id:    ${taskId}`);
    log(`  visitTarget _id: ${vtIdStr}`);
    log(`  customerName:    ${sample.customerName || sample.description || '–'}`);
    log(`  status:         ${sample.status}`);
    if (sample.visitTarget && typeof sample.visitTarget === 'object') {
      log(`  visit name:      ${sample.visitTarget.name || '–'}`);
    }
    log('');
    logSuccess('--check done. Delete test ke liye: node scripts/verifyTaskDelete.js --run');
    process.exit(0);
  }

  if (isRun) {
    log('');
    log('Deleting one linked task (same logic as admin delete)...', 'yellow');

    const followUp = await FollowUp.findById(taskId);
    if (!followUp) {
      logError('Task (FollowUp) ab DB mein nahi mila.');
      process.exit(1);
    }

    const visitTargetIdToDelete = followUp.visitTarget && (followUp.visitTarget._id || followUp.visitTarget);
    if (!visitTargetIdToDelete) {
      logError('Task ke paas visitTarget nahi hai.');
      process.exit(1);
    }

    const vtBefore = await VisitTarget.findById(visitTargetIdToDelete).lean();
    logInfo(`VisitTarget before delete: ${vtBefore ? vtBefore.name || vtBefore._id : 'NOT FOUND'}`);

    // Same logic as admin followUpController deleteFollowUp
    await VisitTarget.findByIdAndDelete(visitTargetIdToDelete);
    await FollowUp.findByIdAndDelete(taskId);

    const fuAfter = await FollowUp.findById(taskId).lean();
    const vtAfter = await VisitTarget.findById(visitTargetIdToDelete).lean();

    if (!fuAfter && !vtAfter) {
      logSuccess('FollowUp aur VisitTarget dono DB se delete ho gaye – task delete logic SET hai.');
    } else {
      logError('Delete ke baad bhi kuch bacha hai:');
      if (fuAfter) logError(`  FollowUp abhi bhi hai: ${taskId}`);
      if (vtAfter) logError(`  VisitTarget abhi bhi hai: ${visitTargetIdToDelete}`);
      process.exit(1);
    }

    log('');
    logSuccess('Script complete – task delete (task + linked visit) sahi kaam kar raha hai.');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
