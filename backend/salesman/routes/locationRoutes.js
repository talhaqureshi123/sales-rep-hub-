const express = require('express');
const router = express.Router();
const {
  saveLocation,
  getLocationHistory,
  getLatestLocation,
} = require('../controller/locationController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.route('/').get(getLocationHistory).post(saveLocation);
router.get('/latest', getLatestLocation);

module.exports = router;


