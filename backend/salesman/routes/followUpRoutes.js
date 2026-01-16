const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const { getMyFollowUps, getMyFollowUp, updateMyFollowUp } = require('../controller/followUpController');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.route('/').get(getMyFollowUps);
router.route('/:id').get(getMyFollowUp).put(updateMyFollowUp);

module.exports = router;

