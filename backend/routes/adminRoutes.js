const express = require("express");
const router  = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  setLeaveType,
  getAllLeaveTypes,
  deleteLeaveType,
  adjustBalance,
  syncAllBalances,
  getEmployeeResults,
  getLeaveHistory,
  getAllLeaves
} = require("../controllers/adminController");

// All admin routes require authentication + admin role
router.use(verifyToken, requireRole("admin", "hod"));

// ── Leave Types ───────────────────────────────────────────────────────────────
// POST   /api/admin/leave-types/set    — create or update a leave type quota
// GET    /api/admin/leave-types        — list all leave types
// DELETE /api/admin/leave-types/:id   — remove a leave type
router.post("/leave-types/set",    setLeaveType);
router.get("/leave-types",         getAllLeaveTypes);
router.delete("/leave-types/:id",  deleteLeaveType);

// ── Balance Management ────────────────────────────────────────────────────────
// POST /api/admin/adjust-balance       — manually override a staff member's balance
// POST /api/admin/sync-all-balances    — recalculate and store all balances (async)
router.post("/adjust-balance",     adjustBalance);
router.post("/sync-all-balances",  syncAllBalances);

// ── Employee Reporting ────────────────────────────────────────────────────────
// GET /api/admin/employee-results/:empCode          — full balance report for one employee
// GET /api/admin/leave-history/:empCode/:type       — leave history by type for one employee
// GET /api/admin/leaves                             — all full-day leave applications
router.get("/employee-results/:empCode",       getEmployeeResults);
router.get("/leave-history/:empCode/:type",    getLeaveHistory);
router.get("/leaves",                          getAllLeaves);

module.exports = router;