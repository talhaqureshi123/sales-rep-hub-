const express = require('express');
const router = express.Router();
const {
  getShiftPhotos,
  getShiftPhoto,
  createShiftPhoto,
  deleteShiftPhoto,
} = require('../controllers/shiftPhotoController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router
  .route('/')
  .get(getShiftPhotos)
  .post(createShiftPhoto);

router
  .route('/:id')
  .get(getShiftPhoto)
  .delete(deleteShiftPhoto);

module.exports = router;
