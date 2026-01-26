const express = require('express');
const router = express.Router();
const {
  getMyProductVideos,
  getMyProductVideo,
} = require('../controller/productVideoController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router.route('/').get(getMyProductVideos);
router.route('/:id').get(getMyProductVideo);

module.exports = router;
