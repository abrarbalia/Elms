const User = require("../models/User");
const mongoose = require("mongoose");

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add user
exports.addUser = async (req, res) => {
  try {
    const data = req.body;
    
    // Explicit validation for required Numeric fields
    const empCode = Number(data["Employee Code"]);
    const deptCode = Number(data.dept_code);

    if (isNaN(empCode) || empCode <= 0) {
      return res.status(400).json({ message: "Employee Code must be a valid positive number." });
    }
    if (isNaN(deptCode)) {
      return res.status(400).json({ message: "Department Code is required and must be a number." });
    }

    const newUser = new User({
      ...data,
      "Employee Code": empCode,
      dept_code: deptCode,
      Password: isNaN(Number(data.Password)) ? data.Password : Number(data.Password)
    });

    await newUser.save();
    res.json({ message: "User added successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Employee Code or Email already exists." });
    }
    console.error("Add user error:", err.message);
    res.status(500).json({ message: "Server error while adding user: " + err.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    // Typecast Password to Number to maintain legacy auth functionality
    const updateData = { ...req.body };
    if (updateData.Password && !isNaN(Number(updateData.Password))) {
      updateData.Password = Number(updateData.Password);
    }

    const updated = await User.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ message: "User updated successfully", data: updated });
  } catch (err) {
    console.error("Update user error:", err.message);
    res.status(500).json({ message: "Failed to update user." });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err.message);
    res.status(500).json({ message: "Failed to delete user." });
  }
};