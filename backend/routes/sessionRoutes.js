const express = require("express");
const router  = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  setSession,
  getActiveSession,
  getAllSessions,
  getSessionList
} = require("../controllers/sessionController");

// POST /api/sessions/set     — admin only
router.post("/set",    verifyToken, requireRole("admin"), setSession);

// GET  /api/sessions/active  — any logged-in user
router.get("/active",  verifyToken, getActiveSession);

// GET  /api/sessions/all     — any logged-in user
router.get("/all",     verifyToken, getAllSessions);

// GET  /api/sessions/list    — any logged-in user
router.get("/list",    verifyToken, getSessionList);

module.exports = router;