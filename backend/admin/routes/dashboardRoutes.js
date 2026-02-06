const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect);
router.use(authorize('admin'));
router.route('/').get(getDashboardStats);

module.exports = router;
