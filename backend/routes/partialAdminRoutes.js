const express = require("express");
const router = express.Router();

const {
  applyLeave,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  getFacultyLeaves,
  getLeaveStats,
  adminAddLeave,
  getPendingLeaves,
  deleteLeave,
  updateLeave,
  getUserByEmpCode,
  getDeletedLeaves,
  restoreLeave,
  getConsolidatedReport,
} = require("../controllers/partialadminController");

// ── Core CRUD ────────────────────────────────────────────────
router.post("/apply",              applyLeave);
router.get("/all",                 getAllLeaves);
router.get("/faculty/:facultyId",  getFacultyLeaves);
router.get("/user/:empCode",       getUserByEmpCode);
router.get("/stats",               getLeaveStats);
router.get("/pending",             getPendingLeaves);
router.post("/admin-add",          adminAddLeave);

// ── Approve / Reject / Update ────────────────────────────────
router.put("/approve/:id",  approveLeave);
router.put("/reject/:id",   rejectLeave);
router.put("/update/:id",   updateLeave);

// ── Soft Delete ──────────────────────────────────────────────
router.delete("/delete/:id", deleteLeave);

// ── Recycle Bin ──────────────────────────────────────────────
router.get("/recycle-bin",    getDeletedLeaves);
router.put("/restore/:id",    restoreLeave);

// ── Consolidated Report ──────────────────────────────────────
router.get("/consolidated",   getConsolidatedReport);

module.exports = router;