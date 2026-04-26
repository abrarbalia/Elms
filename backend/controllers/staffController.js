const User = require("../models/User");
const bcrypt = require("bcryptjs");

// GET all staff
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({}).lean();
    res.json(staff);
  } catch (error) {
    console.error("Get staff error:", error.message);
    res.status(500).json({ message: "Failed to fetch staff." });
  }
};

// GET single staff by empCode
exports.getStaffByEmpCode = async (req, res) => {
  try {
    const empCode = Number(req.params.empCode);
    if (isNaN(empCode)) return res.status(400).json({ message: "Invalid employee code." });

    const user = await User.findOne({ "Employee Code": empCode }).lean();
    if (!user) return res.status(404).json({ message: "Employee not found." });

    res.json(user);
  } catch (error) {
    console.error("Get staff error:", error.message);
    res.status(500).json({ message: "Server error." });
  }
};

// POST create new staff — auto-increments Employee Code
exports.createStaff = async (req, res) => {
  try {
    const { Name, Email, Password, role, department, dept_code, staffType } = req.body;

    if (!Name || !Email || !Password) {
      return res.status(400).json({ message: "Name, Email, and Password are required." });
    }

    const existing = await User.findOne({ Email });
    if (existing) {
      return res.status(400).json({ message: "An employee with this email already exists." });
    }

    const latest = await User.findOne().sort({ "Employee Code": -1 }).lean();
    const nextCode = latest ? (latest["Employee Code"] || 100) + 1 : 101;

    const newUser = await User.create({
      "Employee Code": nextCode,
      Name,
      Email,
      Password: Number(Password),
      role:       role       || "faculty",
      department: department || "",
      dept_code:  dept_code  ? Number(dept_code) : null,
      staffType:  staffType  || "Teaching"
    });

    res.status(201).json({ message: "Staff created successfully.", data: newUser });
  } catch (error) {
    console.error("Create staff error:", error.message);
    res.status(500).json({ message: "Failed to create staff." });
  }
};

// PUT update staff by MongoDB _id
exports.updateStaff = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Employee not found." });
    res.json({ message: "Staff updated successfully.", data: updated });
  } catch (error) {
    console.error("Update staff error:", error.message);
    res.status(500).json({ message: "Failed to update staff." });
  }
};

// DELETE staff by MongoDB _id
exports.deleteStaff = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Employee not found." });
    res.json({ message: "Staff deleted successfully." });
  } catch (error) {
    console.error("Delete staff error:", error.message);
    res.status(500).json({ message: "Failed to delete staff." });
  }
};

// PUT update own profile (email + password only)
exports.updateProfile = async (req, res) => {
  try {
    const empCode = Number(req.params.empCode);
    if (isNaN(empCode)) return res.status(400).json({ message: "Invalid employee code." });

    const { Email, Password } = req.body;
    if (!Email || !Password) {
      return res.status(400).json({ message: "Email and Password are required." });
    }

    const parsedPassword = isNaN(Number(Password)) ? Password : Number(Password);

    const updated = await User.findOneAndUpdate(
      { "Employee Code": empCode },
      { Email, Password: parsedPassword },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Employee not found." });

    res.json({ message: "Profile updated successfully.", data: updated });
  } catch (error) {
    console.error("Update profile error:", error.message);
    res.status(500).json({ message: "Failed to update profile." });
  }
};