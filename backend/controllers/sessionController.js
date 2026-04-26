const Session  = require("../models/Session");
const LeaveType = require("../models/LeaveType");
const Leave     = require("../models/Leave");

const DEFAULT_LEAVE_TYPES = [
  { name: "CL",  limit: 12, cf: false },
  { name: "SL",  limit: 12, cf: true  },
  { name: "AL",  limit: 0,  cf: false },
  { name: "VAL", limit: 0,  cf: false },
  { name: "DL",  limit: 0,  cf: false },
  { name: "SAT", limit: 12, cf: false },
  { name: "EL",  limit: 12, cf: true  }
];

// POST /api/admin/set-session
// Creates or updates the active session; auto-seeds leave type quotas if new
exports.setSession = async (req, res) => {
  try {
    const { sessionName, startDate, endDate } = req.body;

    if (!sessionName || !startDate || !endDate) {
      return res.status(400).json({ message: "sessionName, startDate, and endDate are required." });
    }

    // Use sessionName as the stable identifier — no empty-filter risk
    await Session.findOneAndUpdate(
      { sessionName },
      { sessionName, startDate, endDate },
      { upsert: true, new: true }
    );

    // Auto-seed default quotas if none exist for this session yet
    const existingQuotas = await LeaveType.countDocuments({ sessionName });
    if (existingQuotas === 0) {
      const seedData = DEFAULT_LEAVE_TYPES.map(t => ({
        leave_name:         t.name,
        total_yearly_limit: t.limit,
        dept_code:          0,
        staffType:          "All",
        can_carry_forward:  t.cf,
        sessionName
      }));
      await LeaveType.insertMany(seedData);
      console.log(`Auto-seeded default leave quotas for session: ${sessionName}`);
    }

    res.json({ success: true, message: `Session '${sessionName}' saved.` });
  } catch (error) {
    console.error("Set session error:", error.message);
    res.status(500).json({ message: "Failed to save session." });
  }
};

// GET /api/sessions/active — returns the most recently updated session
exports.getActiveSession = async (req, res) => {
  try {
    const session = await Session.findOne().sort({ updatedAt: -1 }).lean();
    res.json(session || { sessionName: "Not Set", startDate: "", endDate: "" });
  } catch (error) {
    console.error("Get active session error:", error.message);
    res.status(500).json({ message: "Failed to fetch active session." });
  }
};

// GET /api/sessions/all — all saved sessions for dropdowns
exports.getAllSessions = async (req, res) => {
  try {
    const sessions = await Session.find().sort({ sessionName: -1 }).lean();
    res.json(sessions);
  } catch (error) {
    console.error("Get sessions error:", error.message);
    res.status(500).json({ message: "Failed to fetch sessions." });
  }
};

// GET /api/sessions/list — deduplicated list derived from leave history + active session
exports.getSessionList = async (req, res) => {
  try {
    const historical = await Leave.distinct("sessionName");

    // Infer sessions from leave dates for legacy records without sessionName
    const dates = await Leave.distinct("from");
    const inferredSessions = dates
      .map(d => {
        const parsed = parseDateLocal(d);
        if (!parsed) return null;
        const year  = parsed.getFullYear();
        const month = parsed.getMonth() + 1;
        return month <= 5 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
      })
      .filter(Boolean);

    const active = await Session.findOne().sort({ updatedAt: -1 }).lean();
    const all = [...historical, ...inferredSessions];
    if (active?.sessionName) all.push(active.sessionName);

    const unique = [...new Set(all)]
      .filter(s => s && s !== "Not Set")
      .sort()
      .reverse();

    res.json(unique);
  } catch (error) {
    console.error("Get session list error:", error.message);
    res.status(500).json({ message: "Failed to fetch session list." });
  }
};

// Parses date strings in both YYYY-MM-DD and M/D/YYYY formats into local time
// Avoids UTC midnight offset issues that shift dates by one day in IST
function parseDateLocal(dateStr) {
  if (!dateStr) return null;
  try {
    if (dateStr.includes("-")) {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    if (dateStr.includes("/")) {
      const [m, d, y] = dateStr.split("/").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(dateStr);
  } catch {
    return null;
  }
}