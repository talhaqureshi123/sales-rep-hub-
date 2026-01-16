const express = require('express');
const router = express.Router();
const {
  startTracking,
  stopTracking,
  getActiveTracking,
  getAllTracking,
} = require('../controller/trackingController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.post('/start', startTracking);
router.get('/active', getActiveTracking);
router.get('/', getAllTracking);
router.put('/stop/:id', stopTracking);

module.exports = router;

