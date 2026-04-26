const Department = require("../models/Department");
const mongoose = require("mongoose");

// ✅ CREATE DEPARTMENT (AUTO INCREMENT dept_code)
exports.createDepartment = async (req, res) => {
  try {
    const { name, dept_code, startTime, endTime } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required ❌" });
    }

    let newDeptCode = dept_code;
    if (!newDeptCode) {
      // Find last department (sorted by dept_code descending)
      const lastDept = await Department.findOne().sort({ dept_code: -1 });
      newDeptCode = lastDept && lastDept.dept_code ? lastDept.dept_code + 1 : 1;
    }

    const newDept = await Department.create({
      name,
      dept_code: newDeptCode,
      startTime,
      endTime
    });

    res.status(201).json({
      message: "Department created successfully ✅",
      data: newDept
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


// ✅ GET ALL DEPARTMENTS
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });

    res.json(departments);

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};



// ✅ GET SINGLE DEPARTMENT
exports.getDepartmentById = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID ❌" });
    }

    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({ message: "Department not found ❌" });
    }

    res.json(department);

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};



// ✅ UPDATE DEPARTMENT
exports.updateDepartment = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID ❌" });
    }

    const { name, dept_code, startTime, endTime } = req.body;

    const updatedDept = await Department.findByIdAndUpdate(
      id,
      { name, dept_code, startTime, endTime },
      { new: true }
    );

    if (!updatedDept) {
      return res.status(404).json({ message: "Department not found ❌" });
    }

    res.json({
      message: "Department updated successfully ✅",
      data: updatedDept
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};



// ✅ DELETE DEPARTMENT
exports.deleteDepartment = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID ❌" });
    }

    const deletedDept = await Department.findByIdAndDelete(id);

    if (!deletedDept) {
      return res.status(404).json({ message: "Department not found ❌" });
    }

    res.json({
      message: "Department deleted successfully 🗑️"
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};