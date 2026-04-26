
const User = require("../models/User");
const PartialLeave = require("../models/PartialLeave");
const Counter = require("../models/Counter");
const Department = require("../models/Department");

const { getNextSrNo } = require("../utils/partialLeaveHelper");

// APPLY PARTIAL LEAVE
exports.applyPartialLeave = async (req, res) => {
  try {
    const { empCode, type, date, timeIn, timeOut, reason } = req.body;

    if (!empCode || !type || !date) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const facultyCode = Number(empCode);

    // 🔹 Find user
    const user = await User.findOne({ "Employee Code": facultyCode });
    if (!user) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // 🔹 Prevent duplicate (same date)
    const existingLeave = await PartialLeave.findOne({
      empCode: facultyCode,
      date,
      isDeleted: { $ne: true }
    });

    if (existingLeave) {
      return res.status(400).json({
        message: "Partial leave already applied for this date"
      });
    }


    // 🔹 Create leave (NO CALCULATION)
    const srNo = await getNextSrNo();

const leave = await PartialLeave.create({
  srNo,
  empCode: facultyCode,
  name: user.Name,
  department: user.department,
  type,
  date,
  timeIn,
  timeOut,
  reason,
  status: "Pending",

  totalMinutes: 0,   // ✅ TEMP
  totalHours: "0 hr" // ✅ TEMP
});
    res.status(201).json({
      success: true,
      data: leave
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET EMPLOYEE LEAVES
exports.getMyPartialLeaves = async (req, res) => {
  try {
    const empCode = Number(req.params.empCode);
    const leaves = await PartialLeave.find({ 
      empCode, 
      isDeleted: { $ne: true } 
    }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leaves" });
  }
};

exports.getAllPartialLeaves = async (req, res) => {
  try {
    const leaves = await PartialLeave.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leaves" });
  }
};

// ADMIN PROCESS LEAVE
exports.processPartialLeave = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const update = { status };
    if (status === "Rejected") update.rejectReason = reason;

    const leave = await PartialLeave.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(leave);
  } catch (err) {
    res.status(500).json({ message: "Failed to process leave" });
  }
};