
const User = require("../models/User");
const PartialLeave = require("../models/PartialLeave");
const Counter = require("../models/Counter");
const Department = require("../models/Department");

const { 
  getNextSrNo, 
  toMinutes, 
  roundToThirty, 
  formatHours 
} = require("../utils/partialLeaveHelper");

// ================= APPLY =================
exports.applyLeave = async (req, res) => {
  try {
    const { empCode, type, date, timeIn, timeOut, reason } = req.body;

    const existing = await PartialLeave.findOne({
      empCode,
      date,
      status: { $in: ["Pending", "Approved"] },
      isDeleted: { $ne: true }
    });

    if (existing) {
      return res.status(400).json({ message: "Already applied ❌" });
    }

    let start = 0, end = 0;
    if (type === "Late")       { start = toMinutes("09:00"); end = toMinutes(timeIn); }
    if (type === "Early")      { start = toMinutes(timeOut); end = toMinutes("18:00"); }
    if (type === "Inbetween")  { start = toMinutes(timeIn);  end = toMinutes(timeOut); }

    let totalMinutes = roundToThirty(end - start);
    const totalHours = formatHours(totalMinutes);

    // Look up user details
    const user = await User.findOne({ "Employee Code": Number(empCode) });
    const name = user ? user.Name : "Unknown";
    const department = user ? user.department : "General";

    const srNo = await getNextSrNo();

    const leave = await PartialLeave.create({
      srNo, empCode, name, department,
      type, date, timeIn, timeOut, totalMinutes, totalHours, reason
    });

    res.json({ message: "Leave applied ✅", leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= GET ALL (exclude deleted) =================
exports.getAllLeaves = async (req, res) => {
  const leaves = await PartialLeave.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
  res.json(leaves);
};

// ================= FACULTY (exclude deleted) =================
exports.getFacultyLeaves = async (req, res) => {
  const leaves = await PartialLeave.find({
    empCode: Number(req.params.facultyId),
    isDeleted: { $ne: true }
  }).sort({ createdAt: -1 });
  res.json(leaves);
};

// ================= STATS (exclude deleted) =================
exports.getLeaveStats = async (req, res) => {
  const filter = { isDeleted: { $ne: true } };
  const total    = await PartialLeave.countDocuments(filter);
  const pending  = await PartialLeave.countDocuments({ ...filter, status: "Pending" });
  const approved = await PartialLeave.countDocuments({ ...filter, status: "Approved" });
  const rejected = await PartialLeave.countDocuments({ ...filter, status: "Rejected" });
  res.json({ total, pending, approved, rejected });
};

// ================= APPROVE =================
exports.approveLeave = async (req, res) => {
  try {
    const { officialIn, officialOut } = req.body;
    if (!officialIn || !officialOut) {
      return res.status(400).json({ message: "Official timings required" });
    }

    const leave = await PartialLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    const officialStart = toMinutes(officialIn);
    const officialEnd   = toMinutes(officialOut);
    const actualIn      = toMinutes(leave.timeIn);
    const actualOut     = toMinutes(leave.timeOut);

    let minutes = 0;
    if (leave.type === "Late")       minutes = actualIn  - officialStart;
    else if (leave.type === "Early") minutes = officialEnd - actualOut;
    else                             minutes = actualOut - actualIn;
    if (minutes < 0) minutes = 0;

    let rounded = Math.ceil(minutes / 30) * 30;
    if (rounded < 30)  rounded = 30;
    if (rounded > 180) rounded = 180;

    leave.officialIn   = officialIn;
    leave.officialOut  = officialOut;
    leave.totalMinutes = rounded;
    leave.totalHours   = formatHours(rounded);
    leave.status       = "Approved";
    await leave.save();

    res.json({ message: "Approved ✅", leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= REJECT =================
exports.rejectLeave = async (req, res) => {
  await PartialLeave.findByIdAndUpdate(req.params.id, { status: "Rejected" });
  res.json({ message: "Rejected ❌" });
};

// ================= SOFT DELETE =================
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await PartialLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    leave.isDeleted = true;
    leave.deletedAt = new Date();
    leave.deletedBy = (req.body && req.body.deletedBy) || "admin";
    await leave.save();

    res.json({ message: "Moved to Recycle Bin ✅" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ================= UPDATE (with recalculation) =================
exports.updateLeave = async (req, res) => {
  try {
    const leave = await PartialLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    const { date, totalMinutes, type, timeIn, timeOut, officialIn, officialOut, reason, status } = req.body;

    // Recalculate if time fields or type are provided, ensuring duration updates on edit
    if (type || timeIn || timeOut || officialIn || officialOut) {
      const oi = officialIn  || leave.officialIn;
      const oo = officialOut || leave.officialOut;
      const ti = timeIn      || leave.timeIn;
      const to = timeOut     || leave.timeOut;
      const resolvedType = type || leave.type;

      const officialStart = toMinutes(oi);
      const officialEnd   = toMinutes(oo);
      const actualIn      = toMinutes(ti);
      const actualOut     = toMinutes(to);

      let minutes = 0;
      if (resolvedType === "Late")       minutes = actualIn  - officialStart;
      else if (resolvedType === "Early") minutes = officialEnd - actualOut;
      else                               minutes = actualOut - actualIn;
      
      if (minutes < 0) minutes = 0;

      let rounded = Math.ceil(minutes / 30) * 30;
      if (rounded < 30 && minutes > 0) rounded = 30; // Min 30 if there's any difference
      if (rounded > 180) rounded = 180;
      if (minutes === 0) rounded = 0;

      leave.totalMinutes = rounded;
      leave.totalHours   = formatHours(rounded);
    } else if (totalMinutes !== undefined) {
      // Fallback to manual override if only totalMinutes is provided
      const rounded = Math.min(Math.ceil(Number(totalMinutes) / 30) * 30, 180);
      leave.totalMinutes = rounded;
      leave.totalHours   = formatHours(rounded);
    }

    if (date)       leave.date   = date;
    if (type)       leave.type   = type;
    if (timeIn)     leave.timeIn = timeIn;
    if (timeOut)    leave.timeOut = timeOut;
    if (officialIn)  leave.officialIn  = officialIn;
    if (officialOut) leave.officialOut = officialOut;
    if (reason !== undefined) leave.reason = reason;
    if (status) leave.status = status;

    await leave.save();
    res.json({ message: "Updated ✅", leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= PENDING (exclude deleted) =================
exports.getPendingLeaves = async (req, res) => {
  const leaves = await PartialLeave.find({
    status: "Pending",
    isDeleted: { $ne: true }
  }).sort({ createdAt: -1 });
  res.json(leaves);
};

// ================= ADMIN ADD LEAVE =================
exports.adminAddLeave = async (req, res) => {
  try {
    const { empCode, type, date, timeIn, timeOut, officialIn, officialOut, reason } = req.body;

    if (!empCode || !type || !date) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const facultyCode = Number(empCode);
    const user = await User.findOne({ "Employee Code": facultyCode });
    if (!user) return res.status(404).json({ message: "Employee not found" });

    const srNo = await getNextSrNo();

    const officialStart = toMinutes(officialIn);
    const officialEnd   = toMinutes(officialOut);
    const actualIn      = toMinutes(timeIn);
    const actualOut     = toMinutes(timeOut);

    let minutes = 0;
    if (type === "Late")       minutes = actualIn  - officialStart;
    else if (type === "Early") minutes = officialEnd - actualOut;
    else                       minutes = actualOut - actualIn;
    if (minutes < 0) minutes = 0;

    let rounded = Math.ceil(minutes / 30) * 30;
    if (rounded < 30)  rounded = 30;
    if (rounded > 180) rounded = 180;

    const totalHours = formatHours(rounded);

    const leave = await PartialLeave.create({
      srNo, empCode: facultyCode,
      name: user.Name, department: user.department,
      type, date, timeIn, timeOut, officialIn, officialOut,
      totalMinutes: rounded, totalHours, reason,
      status: "Approved"
    });

    res.status(201).json({ success: true, leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= USER LOOKUP =================
exports.getUserByEmpCode = async (req, res) => {
  const empCode = Number(req.params.empCode);
  if (!empCode || isNaN(empCode)) {
    return res.status(400).json({ message: "Invalid Employee Code" });
  }
  const user = await User.findOne({ "Employee Code": empCode });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ name: user.Name, department: user.department });
};

// ================= RECYCLE BIN — GET DELETED =================
exports.getDeletedLeaves = async (req, res) => {
  try {
    const leaves = await PartialLeave.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= RECYCLE BIN — RESTORE =================
exports.restoreLeave = async (req, res) => {
  try {
    const leave = await PartialLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    leave.isDeleted = false;
    leave.deletedAt = null;
    leave.deletedBy = "";
    await leave.save();

    res.json({ message: "Restored ✅", leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= CONSOLIDATED REPORT =================
exports.getConsolidatedReport = async (req, res) => {
  try {
    const { fromDate, toDate, empCode, name, department } = req.query;

    // Build match filter
    const match = {
      isDeleted: { $ne: true },
      status: "Approved"
    };

    if (fromDate && toDate) {
      match.date = { $gte: fromDate, $lte: toDate };
    } else if (fromDate) {
      match.date = { $gte: fromDate };
    } else if (toDate) {
      match.date = { $lte: toDate };
    }

    if (empCode) match.empCode = Number(empCode);
    if (department) match.department = department;
    if (name) match.name = { $regex: name, $options: "i" };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            empCode: "$empCode",
            name: "$name",
            department: "$department"
          },
          totalNotWorkMinutes: { $sum: "$totalMinutes" }
        }
      },
      {
        $project: {
          _id: 0,
          empCode: "$_id.empCode",
          name: "$_id.name",
          department: "$_id.department",
          totalNotWorkMinutes: 1,
          totalNotWorkHours: {
            $concat: [
              { $toString: { $floor: { $divide: ["$totalNotWorkMinutes", 60] } } },
              ".",
              {
                $toString: {
                  $multiply: [
                    { $divide: [{ $mod: ["$totalNotWorkMinutes", 60] }, 60] },
                    10
                  ]
                }
              },
              " hr"
            ]
          }
        }
      },
      { $sort: { name: 1 } }
    ];

    const results = await PartialLeave.aggregate(pipeline);

    // Compute grand total minutes
    const grandTotalMinutes = results.reduce((sum, r) => sum + r.totalNotWorkMinutes, 0);
    // ✅ Apply 30min rounding to grand total
    const roundedGrand = Math.round(grandTotalMinutes / 30) * 30;
    const grandH = Math.floor(roundedGrand / 60);
    const grandM = roundedGrand % 60;
    const grandTotalHours = grandM === 0 ? `${grandH} hr` : `${grandH}.5 hr`;

    res.json({
      fromDate: fromDate || null,
      toDate:   toDate   || null,
      grandTotalMinutes,
      grandTotalHours,
      records: results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};