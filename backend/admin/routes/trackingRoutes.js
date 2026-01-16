const express = require('express');
const router = express.Router();
const { getAllTracking, getTracking, getActiveTrackingSessions } = require('../controllers/trackingController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/active', getActiveTrackingSessions);
router.get('/', getAllTracking);
router.get('/:id', getTracking);

module.exports = router;
