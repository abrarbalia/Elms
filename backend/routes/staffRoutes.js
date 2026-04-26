const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const {
    getAllStaff,
    getStaffByEmpCode,
    createStaff,
    updateStaff,
    deleteStaff,
    updateProfile
} = require("../controllers/staffController");

// All staff routes require a valid JWT
router.use(verifyToken);

// GET  /api/staff           — admin/hod sees all staff
// GET  /api/staff/:empCode  — fetch single employee
// POST /api/staff           — admin creates a new employee
// PUT  /api/staff/:id       — admin updates employee by _id
// DELETE /api/staff/:id     — admin deletes employee

router.get("/", requireRole("admin", "hod"), getAllStaff);
router.get("/:empCode", requireRole("admin", "hod"), getStaffByEmpCode);
router.post("/", requireRole("admin", "hod"), createStaff);
router.put("/:id", requireRole("admin", "hod"), updateStaff);
router.delete("/:id", requireRole("admin", "hod"), deleteStaff);

// PUT /api/staff/profile/:empCode — faculty updates own profile
router.put("/profile/:empCode", updateProfile);

module.exports = router;