const PartialLeaveType = require("../models/PartialLeaveTypeModel");
const mongoose = require("mongoose");

// CREATE Partial Leave Type
exports.createPartialLeaveType = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required ❌" });

    const existing = await PartialLeaveType.findOne({ name });
    if (existing) return res.status(400).json({ message: "Name already exists ❌" });

    const newPLT = await PartialLeaveType.create({ name });

    res.status(201).json({
      message: "Partial Leave Type created successfully ✅",
      data: newPLT
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET All Partial Leave Types
exports.getPartialLeaveTypes = async (req, res) => {
  try {
const partialLeaveTypes = await PartialLeaveType.find().sort({ createdAt: -1 });
    res.json(partialLeaveTypes);
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET Single Partial Leave Type by ID
exports.getPartialLeaveTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) 
      return res.status(400).json({ message: "Invalid ID ❌" });

    const plt = await PartialLeaveType.findById(id);
    if (!plt) return res.status(404).json({ message: "Partial Leave Type not found ❌" });

    res.json(plt);
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// UPDATE Partial Leave Type
exports.updatePartialLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) 
      return res.status(400).json({ message: "Invalid ID ❌" });

    const updateData = {};
    if (name !== undefined) updateData.name = name;

    const updatedPLT = await PartialLeaveType.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedPLT) return res.status(404).json({ message: "Partial Leave Type not found ❌" });

    res.json({
      message: "Partial Leave Type updated successfully ✅",
      data: updatedPLT
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Name already exists ❌" });
    }
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE Partial Leave Type
exports.deletePartialLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) 
      return res.status(400).json({ message: "Invalid ID ❌" });

    const deletedPLT = await PartialLeaveType.findByIdAndDelete(id);
    if (!deletedPLT) return res.status(404).json({ message: "Partial Leave Type not found ❌" });

    res.json({ message: "Partial Leave Type deleted successfully 🗑️" });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};