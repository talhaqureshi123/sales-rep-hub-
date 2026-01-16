const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const { getAchievementStats } = require('../controller/achievementController');

// All routes require authentication
router.use(protect);

router.route('/').get(getAchievementStats);

module.exports = router;

