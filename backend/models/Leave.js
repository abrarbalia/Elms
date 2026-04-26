const mongoose = require("mongoose");

// All status values are Title Case — enforced here so queries never need mixed-case $in arrays
const LEAVE_STATUSES = ["Pending", "HOD Approved", "Approved", "Final Approved", "Rejected"];

const leaveSchema = new mongoose.Schema(
  {
    sr_no:           { type: String },
    Emp_CODE:        { type: Number, required: true },
    Name:            { type: String, required: true },
    Dept_Code:       { type: Number },
    leaveType:       { type: String, required: true, uppercase: true, trim: true },
    from:            { type: String, required: true },
    to:              { type: String, required: true },
    totalDays:       { type: Number, required: true },
    sessionName:     { type: String, required: true },
    reason:          { type: String },
    document:        { type: String },
    VAL_working_dates: { type: String },
    status:          { type: String, enum: LEAVE_STATUSES, default: "Pending" },
    HOD_Approved:    { type: Boolean, default: false },
    rejectReason:    { type: String }
  },
  { collection: "leave_applications", timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Leave", leaveSchema);
module.exports.LEAVE_STATUSES = LEAVE_STATUSES;