const express = require("express");
const router  = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const { login, changePassword, register } = require("../controllers/authController");

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/change-password
router.post("/change-password", changePassword);

// POST /api/auth/register (Admin Only)
router.post("/register", verifyToken, requireRole("admin"), register);

module.exports = router;