const express = require('express');
const router = express.Router();
const {
  getVisitTargets,
  getMyVisitRequests,
  getVisitTarget,
  createVisitRequest,
  updateVisitTargetStatus,
  checkProximity,
} = require('../controller/visitTargetController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

// Requests (salesman-created) -> admin approval required
router.route('/requests').get(getMyVisitRequests);
router.route('/request').post(createVisitRequest);

router.route('/').get(getVisitTargets);
router.route('/:id').get(getVisitTarget).put(updateVisitTargetStatus);
router.post('/:id/check-proximity', checkProximity);

module.exports = router;

