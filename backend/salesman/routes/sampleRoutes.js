const express = require('express');
const router = express.Router();
const {
  getSamples,
  getSample,
  createSample,
  updateSample,
} = require('../controller/sampleController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize('salesman'));

router
  .route('/')
  .get(getSamples)
  .post(createSample);

router
  .route('/:id')
  .get(getSample)
  .put(updateSample);

module.exports = router;
