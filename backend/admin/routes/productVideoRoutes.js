const express = require('express');
const router = express.Router();
const {
  getProductVideos,
  getProductVideo,
  createProductVideo,
  updateProductVideo,
  deleteProductVideo,
} = require('../controllers/productVideoController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router
  .route('/')
  .get(getProductVideos)
  .post(createProductVideo);

router
  .route('/:id')
  .get(getProductVideo)
  .put(updateProductVideo)
  .delete(deleteProductVideo);

module.exports = router;
