const path = require('path');
const moduleAlias = require('module');

// --- PRODUCTION BOOTSTRAP ---
// In packaged Electron, node_modules are moved to app.asar.unpacked
if (process.env.NODE_ENV === 'production' || !process.env.isDev) {
    const resourcesPath = process.resourcesPath || path.join(process.cwd(), 'resources');
    const unpackedModules = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
    
    if (require('fs').existsSync(unpackedModules)) {
        process.env.NODE_PATH = unpackedModules + path.delimiter + (process.env.NODE_PATH || '');
        require('module').Module._initPaths();
    }
}

console.log("--- Server script execution started ---");
const express  = require("express");
const cors     = require("cors");
const helmet   = require("helmet");
const rateLimit = require("express-rate-limit");
const cron     = require("node-cron");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const PORT = process.env.PORT || 5000;
console.log(`[Config] Attempting to start on PORT: ${PORT}`);
if (!process.env.MONGO_URI) {
  console.warn("⚠️  Warning: MONGO_URI is not defined in .env file.");
}

const { connectDB }      = require("./config/db");
const authRoutes         = require("./routes/authRoutes");
const staffRoutes        = require("./routes/staffRoutes");
const sessionRoutes      = require("./routes/sessionRoutes");
const leaveRoutes        = require("./routes/leaveRoutes");
const partialLeaveRoutes = require("./routes/partialLeaveRoutes");
const adminRoutes        = require("./routes/adminRoutes");
const departmentRoutes   = require("./routes/departmentRoutes");
const partialLeaveTypeRoutes = require("./routes/partialLeaveTypeRoutes");
const partialAdminRoutes  = require("./routes/partialAdminRoutes");
const userRoutes = require("./routes/adminAddUserRoutes");
const app = express();

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet()); // Sets secure HTTP headers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { message: "Too many requests from this IP, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter); // Apply rate limiting to all API routes

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Serve uploaded documents (medical certificates etc.)
const uploadsPath = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

// ── Database ──────────────────────────────────────────────────────────────────
connectDB();

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",           authRoutes);
app.use("/api/staff",          staffRoutes);
app.use("/api/sessions",       sessionRoutes);
app.use("/api/leaves",         leaveRoutes);
app.use("/api/partial-leaves", partialLeaveRoutes);
app.use("/api/admin",          adminRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/partial-leave-types", partialLeaveTypeRoutes);
app.use("/api/partialadmin", partialAdminRoutes);
app.use("/api/users", userRoutes);
// Health check
app.get("/api/health", (req, res) => res.json({ status: "OK", timestamp: new Date() }));

// ── 90-Day Auto-Purge Cron Job ────────────────────────────────────────────────
// Runs every day at midnight — permanently deletes records soft-deleted 90+ days ago
const PartialLeave = require("./models/PartialLeave");
cron.schedule("0 0 * * *", async () => {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await PartialLeave.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });
    console.log(`[Cron] Auto-purged ${result.deletedCount} old deleted record(s) at ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[Cron] Auto-purge error:", err.message);
  }
}, { timezone: "Asia/Kolkata" });
app.get("/", (req, res) => res.json({ message: "Leave Management API is running." }));

const { getDashboardStats } = require("./controllers/leaveController");
const { verifyToken, requireRole } = require("./middleware/auth");
app.get("/api/dashboard-stats", verifyToken, requireRole("admin", "hod"), getDashboardStats);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} ✅`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`👉 Suggestion: Run 'taskkill /F /IM node.exe' on Windows or kill the process using port ${PORT}.`);
  } else {
    console.error(`❌ Server error: ${error.message}`);
  }
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error(`❌ Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});