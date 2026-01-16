/* COMMENTED OUT - MILESTONE FUNCTIONALITY DISABLED
const express = require("express");
const router = express.Router();
const {
  getMilestones,
  getMilestone,
  createMilestone,
  updateMilestone,
  markMilestoneComplete,
  checkProximity,
  deleteMilestone,
} = require("../controller/milestoneController");
const { protect, authorize } = require("../../middleware/auth");

// All routes require authentication and salesman role
router.use(protect);
router.use(authorize("salesman"));

router.route("/").get(getMilestones).post(createMilestone);
router
  .route("/:id")
  .get(getMilestone)
  .put(updateMilestone)
  .delete(deleteMilestone);
router.put("/:id/complete", markMilestoneComplete);
router.post("/:id/check-proximity", checkProximity);

module.exports = router;
*/

// Return empty router to prevent errors
const express = require("express");
const router = express.Router();
module.exports = router;
