const express = require('express');
const router = express.Router();
const { getTasksList } = require('../controllers/tasksListController');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect);
router.use(authorize('admin'));
router.route('/').get(getTasksList);

module.exports = router;
