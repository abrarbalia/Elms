const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  applyLeave,
  getMyLeaves,
  getBalance,
  processLeave
} = require("../controllers/leaveController");

// ── Multer Setup (scoped to this router) ─────────────────────────────────────
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
const MAX_FILE_SIZE_MB   = 5;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and PDF files are allowed."));
    }
  }
});

// Multer error handler middleware
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.` });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) return res.status(400).json({ message: err.message });
  next();
}

// All leave routes require authentication
router.use(verifyToken);

// POST /api/leaves/apply            — faculty submits a leave
router.post("/apply", upload.single("document"), handleUploadError, applyLeave);

// GET  /api/leaves/my/:empCode      — faculty views own leaves
router.get("/my/:empCode", getMyLeaves);

// GET  /api/leaves/balance/:empCode/:type  — check remaining balance
router.get("/balance/:empCode/:type", getBalance);

// POST /api/leaves/process/:id      — admin/hod approves or rejects
router.post(
  "/process/:id",
  requireRole("admin", "hod"),
  processLeave
);

module.exports = router;