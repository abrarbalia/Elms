const express = require("express");
const router = express.Router();

const {
  applyPartialLeave,
  getMyPartialLeaves,
  getAllPartialLeaves,
  processPartialLeave
} = require("../controllers/partialLeaveController");

// Leave application
router.post("/apply", applyPartialLeave);

// Faculty view their leaves
router.get("/my/:empCode", getMyPartialLeaves);

// Admin view all leaves
router.get("/all", getAllPartialLeaves);

// Admin approve/reject
router.post("/process/:id", processPartialLeave);

module.exports = router; 