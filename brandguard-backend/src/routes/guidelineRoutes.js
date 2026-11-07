const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const guidelineUpload = require("../middleware/guidelineUpload");

const {
  getGuidelines,
  getGuidelineById,
  createGuideline,
  updateGuideline,
  deleteGuideline
} = require("../controllers/guidelineController");

router.use(protect);

// All authenticated roles can view guidelines
router.get("/", getGuidelines);
router.get("/:id", getGuidelineById);

// Only Admin can manage guidelines
router.post("/", authorizeRoles("Admin"), guidelineUpload.single("file"), createGuideline);
router.patch("/:id", authorizeRoles("Admin"), guidelineUpload.single("file"), updateGuideline);
router.delete("/:id", authorizeRoles("Admin"), deleteGuideline);

module.exports = router;