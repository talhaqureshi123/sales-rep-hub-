const express = require('express');
const router = express.Router();
const {
  getSamples,
  getSample,
  createSample,
  updateSample,
  deleteSample,
  getSampleStats,
} = require('../controllers/sampleController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getSampleStats);
router.route('/').get(getSamples).post(createSample);
router.route('/:id').get(getSample).put(updateSample).delete(deleteSample);

module.exports = router;
