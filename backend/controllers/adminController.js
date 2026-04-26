const User              = require("../models/User");
const Leave             = require("../models/Leave");
const LeaveType         = require("../models/LeaveType");
const Session           = require("../models/Session");
const BalanceAdjustment = require("../models/BalanceAdjustment");
const { calculateUserBalance } = require("./leaveController");

// ── Leave Type Management ─────────────────────────────────────────────────────

// POST /api/admin/leave-types/set
exports.setLeaveType = async (req, res) => {
  try {
    const { leave_name, total_yearly_limit, dept_code, staffType, can_carry_forward, sessionName } = req.body;

    if (!leave_name || !sessionName) {
      return res.status(400).json({ message: "leave_name and sessionName are required." });
    }

    const updated = await LeaveType.findOneAndUpdate(
      {
        leave_name:  leave_name.toUpperCase().trim(),
        dept_code:   Number(dept_code) || 0,
        staffType:   staffType || "All",
        sessionName
      },
      { total_yearly_limit: Number(total_yearly_limit) || 0, can_carry_forward: !!can_carry_forward },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Set leave type error:", error.message);
    res.status(500).json({ message: "Failed to save leave type." });
  }
};

// GET /api/admin/leave-types
exports.getAllLeaveTypes = async (req, res) => {
  try {
    const types = await LeaveType.find({}).lean();
    res.json(types);
  } catch (error) {
    console.error("Get leave types error:", error.message);
    res.status(500).json({ message: "Failed to fetch leave types." });
  }
};

// DELETE /api/admin/leave-types/:id
exports.deleteLeaveType = async (req, res) => {
  try {
    const deleted = await LeaveType.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Leave type not found." });
    res.json({ success: true, message: "Leave type deleted." });
  } catch (error) {
    console.error("Delete leave type error:", error.message);
    res.status(500).json({ message: "Failed to delete leave type." });
  }
};

// ── Balance Adjustment ────────────────────────────────────────────────────────

// POST /api/admin/adjust-balance
exports.adjustBalance = async (req, res) => {
  try {
    const { empCode, leaveType, sessionName, adjustmentValue } = req.body;

    if (!empCode || !leaveType || !sessionName || adjustmentValue === undefined) {
      return res.status(400).json({ message: "empCode, leaveType, sessionName, and adjustmentValue are required." });
    }

    const updated = await BalanceAdjustment.findOneAndUpdate(
      {
        empCode:     Number(empCode),
        leaveType:   leaveType.toUpperCase().trim(),
        sessionName
      },
      { adjustmentValue: Number(adjustmentValue) },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Adjust balance error:", error.message);
    res.status(500).json({ message: "Failed to adjust balance." });
  }
};

// ── Sync All Balances ─────────────────────────────────────────────────────────
// Runs in background — responds immediately then processes asynchronously
// POST /api/admin/sync-all-balances
exports.syncAllBalances = async (req, res) => {
  try {
    const activeSession = await Session.findOne().sort({ updatedAt: -1 }).lean();
    if (!activeSession) {
      return res.status(400).json({ message: "No active session set." });
    }

    // Respond immediately so the HTTP request doesn't time out
    res.json({ success: true, message: "Balance sync started in background." });

    // Process asynchronously after response
    const sessionName  = activeSession.sessionName;
    const users        = await User.find({}).lean();
    const leaveTypeNames = await LeaveType.distinct("leave_name", { sessionName });

    let syncCount = 0;

    // Process users in parallel batches of 10 to avoid DB overload
    const BATCH_SIZE = 10;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async user => {
          const empCode = user["Employee Code"];
          if (!empCode) return;

          await Promise.all(
            leaveTypeNames.map(async type => {
              const result = await calculateUserBalance(empCode, type, sessionName);
              await BalanceAdjustment.findOneAndUpdate(
                { empCode: Number(empCode), leaveType: type.toUpperCase(), sessionName },
                { adjustmentValue: Number(result.balance) },
                { upsert: true }
              );
              syncCount++;
            })
          );
        })
      );
    }

    console.log(`[Sync] Completed. Records updated: ${syncCount}`);
  } catch (error) {
    console.error("Sync error:", error.message);
    // Response already sent — just log
  }
};

// ── Employee Results Dashboard ────────────────────────────────────────────────

// GET /api/admin/employee-results/:empCode
exports.getEmployeeResults = async (req, res) => {
  try {
    const empCode = Number(req.params.empCode);
    if (isNaN(empCode)) return res.status(400).json({ message: "Invalid employee code." });

    const user = await User.findOne({ "Employee Code": empCode }).lean();
    if (!user) return res.status(404).json({ message: "Employee not found." });

    const activeSession = await Session.findOne().sort({ updatedAt: -1 }).lean();
    const sessionName   = activeSession?.sessionName || "2025-26";

    const leaveTypeNames = await LeaveType.distinct("leave_name", { sessionName });

    const balances = await Promise.all(
      leaveTypeNames.map(async type => {
        const b = await calculateUserBalance(empCode, type, sessionName);
        return {
          type,
          balance:        b.balance,
          used:           b.usedThisYear,
          limit:          b.limit,
          isIncrementing: b.isIncrementing
        };
      })
    );

    res.json({
      user: {
        name:       user.Name,
        empCode:    user["Employee Code"],
        role:       user.role,
        dept_code:  user.dept_code,
        department: user.department,
        staffType:  user.staffType
      },
      balances,
      sessionName
    });
  } catch (error) {
    console.error("Employee results error:", error.message);
    res.status(500).json({ message: "Failed to fetch employee results." });
  }
};

// GET /api/admin/leave-history/:empCode/:type
exports.getLeaveHistory = async (req, res) => {
  try {
    const empCode = Number(req.params.empCode);
    if (isNaN(empCode)) return res.status(400).json({ message: "Invalid employee code." });

    const type          = req.params.type.toUpperCase().trim();
    const activeSession = await Session.findOne().sort({ updatedAt: -1 }).lean();
    const sessionName   = activeSession?.sessionName || "2025-26";

    const history = await Leave.find({
      Emp_CODE:    empCode,
      leaveType:   type,
      sessionName,
      status: { $in: ["Pending", "HOD Approved", "Approved", "Final Approved"] }
    })
      .sort({ from: -1 })
      .lean();

    res.json(history);
  } catch (error) {
    console.error("Leave history error:", error.message);
    res.status(500).json({ message: "Failed to fetch leave history." });
  }
};

// GET /api/admin/leaves — all leaves for admin view
exports.getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({}).sort({ createdAt: -1 }).lean();
    res.json(leaves);
  } catch (error) {
    console.error("Get all leaves error:", error.message);
    res.status(500).json({ message: "Failed to fetch leaves." });
  }
};