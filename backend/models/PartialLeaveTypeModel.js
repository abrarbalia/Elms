const mongoose = require("mongoose");
const partialLeaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
}, { 
  timestamps: true,
  collection: "partial_leave_type" // ✅ FORCE COLLECTION NAME
});

module.exports = mongoose.model("PartialLeaveType", partialLeaveTypeSchema);