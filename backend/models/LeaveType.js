const mongoose = require("mongoose");

const leaveTypeSchema = new mongoose.Schema(
  {
    leave_name:          { type: String, required: true, uppercase: true, trim: true },
    total_yearly_limit:  { type: Number, default: 0 },
    dept_code:           { type: Number, default: 0 },   // 0 = applies to all departments
    staffType:           { type: String, default: "All" },
    can_carry_forward:   { type: Boolean, default: false },
    sessionName:         { type: String, required: true }
  },
  { collection: "leave_types", versionKey: false }
);

module.exports = mongoose.model("LeaveType", leaveTypeSchema);