const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const { getMyFollowUps, getMyFollowUp, createMyFollowUp, updateMyFollowUp, importMyFollowUps } = require('../controller/followUpController');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.route('/').get(getMyFollowUps).post(createMyFollowUp);
router.post('/import', importMyFollowUps);
router.route('/:id').get(getMyFollowUp).put(updateMyFollowUp);

module.exports = router;

