const express = require("express");
const router = express.Router();

const pltController = require("../controllers/partialLeaveTypeController");

// Routes
router.post("/", pltController.createPartialLeaveType);
router.get("/", pltController.getPartialLeaveTypes);
router.get("/:id", pltController.getPartialLeaveTypeById);
router.put("/:id", pltController.updatePartialLeaveType);
router.delete("/:id", pltController.deletePartialLeaveType);

module.exports = router;