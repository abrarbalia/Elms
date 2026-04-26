const User              = require("../models/User");
const Leave             = require("../models/Leave");
const LeaveType         = require("../models/LeaveType");
const Session           = require("../models/Session");
const BalanceAdjustment = require("../models/BalanceAdjustment");
const path              = require("path");

// ── Date Helpers ──────────────────────────────────────────────────────────────

// Parses "YYYY-MM-DD" and "M/D/YYYY" into local midnight — avoids UTC offset shifting dates in IST
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

// ── Balance Calculator (exported so adminController can reuse it) ─────────────
async function calculateUserBalance(empCode, type, sessionName) {
  const employeeCode = Number(empCode);
  if (isNaN(employeeCode) || employeeCode <= 0) {
    return { balance: 0, error: "Invalid employee code." };
  }

  const leaveTypeUpper     = type.toUpperCase().trim();
  const currentSessionName = sessionName;

  // 1. Fetch user
  const emp = await User.findOne({ "Employee Code": employeeCode }).lean();
  if (!emp) return { balance: 0, error: "User not found." };

  const userDeptCode = String(emp.dept_code || "");

  // 2. Fetch leave type rules applicable to this user's department
  const allRulesForType = await LeaveType.find({ leave_name: leaveTypeUpper }).lean();
  const userRules = allRulesForType.filter(r =>
    String(r.dept_code) === userDeptCode || String(r.dept_code) === "0"
  );

  let currentRule = userRules.find(r => r.sessionName === currentSessionName);
  if (!currentRule) {
    // Fallback defaults when no rule is configured yet
    currentRule = {
      leave_name:         leaveTypeUpper,
      total_yearly_limit: ["AL", "VAL", "DL"].includes(leaveTypeUpper) ? 0 : 12,
      can_carry_forward:  leaveTypeUpper === "SL" || leaveTypeUpper === "EL",
      sessionName:        currentSessionName
    };
  }

  // 3. Determine mode: limit=0 means accumulating (AL, VAL, DL); limit>0 means deducting
  const isIncrementing = Number(currentRule.total_yearly_limit) === 0;

  // 4. Calculate leaves used this session
  const leavesThisSession = await Leave.find({
    Emp_CODE:    employeeCode,
    sessionName: currentSessionName,
    leaveType:   leaveTypeUpper,
    status:      { $in: ["Pending", "HOD Approved", "Approved", "Final Approved"] }
  }).lean();

  const usedThisYear = leavesThisSession.reduce(
    (sum, l) => sum + (Number(l.totalDays) || 0), 0
  );

  // 5. Check for a manual admin adjustment
  const manualAdjustment = await BalanceAdjustment.findOne({
    empCode:     employeeCode,
    leaveType:   leaveTypeUpper,
    sessionName: currentSessionName
  }).lean();

  // 6. Return balance based on mode
  if (isIncrementing) {
    const finalBalance = manualAdjustment ? manualAdjustment.adjustmentValue : usedThisYear;
    return {
      balance:           finalBalance,
      isIncrementing:    true,
      sessionName:       currentSessionName,
      isManuallyAdjusted: !!manualAdjustment,
      usedThisYear,
      limit:             "-"
    };
  }

  // Deducting mode — add carry-forward from previous sessions
  let totalLimit         = Number(currentRule.total_yearly_limit);
  let carryForwardAmount = 0;

  if (currentRule.can_carry_forward) {
    const currentYearStart = parseInt(currentSessionName.split("-")[0]);
    const pastRules = Array.from(
      new Map(
        userRules
          .filter(r => parseInt(r.sessionName.split("-")[0]) < currentYearStart)
          .map(r => [r.sessionName, r])
      ).values()
    );

    // Fetch past balances in parallel
    const carryAmounts = await Promise.all(
      pastRules.map(async pastRule => {
        const pastAdj = await BalanceAdjustment.findOne({
          empCode:     employeeCode,
          leaveType:   leaveTypeUpper,
          sessionName: pastRule.sessionName
        }).lean();

        if (pastAdj) return Math.max(0, Number(pastAdj.adjustmentValue));

        const pastLeaves = await Leave.find({
          Emp_CODE:    employeeCode,
          sessionName: pastRule.sessionName,
          leaveType:   leaveTypeUpper,
          status:      { $in: ["Approved", "Final Approved", "HOD Approved"] }
        }).lean();

        const pastUsed = pastLeaves.reduce((sum, l) => sum + (Number(l.totalDays) || 0), 0);
        return Math.max(0, Number(pastRule.total_yearly_limit) - pastUsed);
      })
    );

    carryForwardAmount = carryAmounts.reduce((sum, v) => sum + v, 0);
    totalLimit += carryForwardAmount;
  }

  let finalBalance = Math.max(0, totalLimit - usedThisYear);
  let finalLimit   = totalLimit;

  if (manualAdjustment) {
    finalBalance = manualAdjustment.adjustmentValue;
    finalLimit   = finalBalance + usedThisYear;
  }

  return {
    balance:            finalBalance,
    isIncrementing:     false,
    sessionName:        currentSessionName,
    limit:              finalLimit,
    carryForward:       carryForwardAmount,
    currentLimit:       Number(currentRule.total_yearly_limit),
    usedThisYear,
    isManuallyAdjusted: !!manualAdjustment
  };
}

exports.calculateUserBalance = calculateUserBalance;

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/leaves/balance/:empCode/:type
exports.getBalance = async (req, res) => {
  try {
    const { empCode, type }      = req.params;
    const { sessionName: qSession } = req.query;

    let sessionToUse = qSession;
    if (!sessionToUse) {
      const active = await Session.findOne().sort({ updatedAt: -1 }).lean();
      if (!active) return res.json({ balance: 0, error: "No active session set by admin." });
      sessionToUse = active.sessionName;
    }

    const result = await calculateUserBalance(empCode, type, sessionToUse);
    res.json(result);
  } catch (error) {
    console.error("Balance error:", error.message);
    res.status(500).json({ message: "Failed to calculate balance." });
  }
};

// POST /api/leaves/apply
exports.applyLeave = async (req, res) => {
  try {
    const {
      Type_of_Leave, Total_Days, Emp_CODE,
      From, To, sr_no, Name, Dept_Code,
      VAL_working_dates, Reason
    } = req.body;

    const empCodeNum = Number(Emp_CODE);
    const totalDaysNum = Number(Total_Days);
    const deptCodeNum = Number(Dept_Code);

    if (isNaN(empCodeNum) || empCodeNum <= 0) {
      return res.status(400).json({ message: "Invalid or missing Employee Code." });
    }
    if (isNaN(totalDaysNum) || totalDaysNum < 0) {
      return res.status(400).json({ message: "Invalid total days calculated." });
    }

    // VAL requires 3 working dates
    if (Type_of_Leave?.toUpperCase() === "VAL" && !VAL_working_dates?.trim()) {
      return res.status(400).json({
        message: "Please mention the 3 working dates during vacation for VAL leave."
      });
    }

    // SL > 3 days requires a medical document
    if (Type_of_Leave?.toUpperCase() === "SL" && Number(Total_Days) > 3 && !req.file) {
      return res.status(400).json({
        message: "Medical document is required for Sick Leave exceeding 3 days."
      });
    }

    const newStart = parseDateLocal(From);
    const newEnd   = parseDateLocal(To);

    if (!newStart || !newEnd) {
      return res.status(400).json({ message: "Invalid From or To date." });
    }

    // SAT leaves must only fall on Saturdays
    if (Type_of_Leave?.toUpperCase() === "SAT") {
      let current = new Date(newStart);
      while (current <= newEnd) {
        if (current.getDay() !== 6) {
          return res.status(400).json({
            message: "SAT leaves can only be applied on Saturdays."
          });
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Overlapping leave check
    const existing = await Leave.find({
      Emp_CODE: Number(Emp_CODE),
      status:   { $in: ["Pending", "HOD Approved", "Approved", "Final Approved"] }
    }).lean();

    for (const leave of existing) {
      const exStart = parseDateLocal(leave.from);
      const exEnd   = parseDateLocal(leave.to);
      if (!exStart || !exEnd) continue;
      if (newStart <= exEnd && newEnd >= exStart) {
        return res.status(400).json({
          message: `You already have a leave between ${leave.from} and ${leave.to}. Dates cannot overlap.`
        });
      }
    }

    const activeSession = await Session.findOne().sort({ updatedAt: -1 }).lean();

    const newLeave = await Leave.create({
      sr_no,
      Emp_CODE:  empCodeNum,
      Name,
      Dept_Code: isNaN(deptCodeNum) ? undefined : deptCodeNum,
      leaveType: Type_of_Leave.toUpperCase().trim(),
      from:      From,
      to:        To,
      totalDays: totalDaysNum,
      sessionName: activeSession?.sessionName || "2025-26",
      reason:    Reason,
      document:  req.file ? req.file.filename : null,
      VAL_working_dates: Type_of_Leave?.toUpperCase() === "VAL"
        ? VAL_working_dates?.trim()
        : undefined
    });

    res.status(201).json({ success: true, data: newLeave });
  } catch (error) {
    console.error("Apply leave error:", error.message);
    res.status(500).json({ message: "Failed to submit leave." });
  }
};

// GET /api/dashboard-stats
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const leaves = await Leave.find({}).lean();
    const partialLeaves = []; // Assuming we merge logic if needed, but standard leaves for now

    const allLeaves = [...leaves];

    const todayLeaves = allLeaves.filter(l => {
      const d = parseDateLocal(l.from || l.From_Date || l.date);
      return d >= today && d < tomorrow;
    }).length;

    const yesterdayLeaves = allLeaves.filter(l => {
      const d = parseDateLocal(l.from || l.From_Date || l.date);
      return d >= yesterday && d < today;
    }).length;

    const pendingLeaves = allLeaves.filter(l => l.status === "Pending" || l.hodApproval === "Pending").length;
    const approvedLeaves = allLeaves.filter(l => ["Approved", "Final Approved", "HOD Approved"].includes(l.status) || l.hodApproval === "Approved").length;
    const rejectedLeaves = allLeaves.filter(l => l.status === "Rejected" || l.hodApproval === "Rejected").length;

    const staffData = await User.find({}).lean();
    const deptStats = {};
    
    // Dept-wise leave stats
    allLeaves.forEach(l => {
      const dept = l.Dept_Code || "Others";
      if(!deptStats[dept]) deptStats[dept] = 0;
      deptStats[dept]++;
    });

    res.json({
      todayLeaves,
      yesterdayLeaves,
      pendingLeaves,
      approvedLeaves,
      rejectedLeaves,
      deptStats
    });
  } catch (error) {
    console.error("Dashboard stats error:", error.message);
    res.status(500).json({ message: "Failed to fetch dashboard stats." });
  }
};

// GET /api/leaves/my/:empCode
exports.getMyLeaves = async (req, res) => {
  try {
    const empCode = Number(req.params.empCode);
    if (isNaN(empCode)) return res.status(400).json({ message: "Invalid employee code." });

    const leaves = await Leave.find({ Emp_CODE: empCode }).sort({ createdAt: -1 }).lean();
    res.json(leaves);
  } catch (error) {
    console.error("Get my leaves error:", error.message);
    res.status(500).json({ message: "Failed to fetch leaves." });
  }
};

// POST /api/leaves/process/:id — approve / reject
exports.processLeave = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const validStatuses = ["HOD Approved", "Approved", "Final Approved", "Rejected"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const updateData = { status };
    if (status === "Rejected" && reason) updateData.rejectReason = reason;

    const updated = await Leave.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Leave not found." });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Process leave error:", error.message);
    res.status(500).json({ message: "Failed to process leave." });
  }
};