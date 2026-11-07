const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { getAllFindings } = require("../controllers/aiController");

router.use(protect);

router.get("/", getAllFindings);

module.exports = router;