const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const { getDashboardStats } = require('../controller/dashboardController');

// All routes require authentication
router.use(protect);

router.route('/').get(getDashboardStats);

module.exports = router;

