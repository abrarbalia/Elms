const mongoose = require("mongoose");

const partialLeaveSchema = new mongoose.Schema({
  empCode: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  department: { type: String, required: true },

  type: {
    type: String,
    enum: ["Late", "Early", "Inbetween"],
    required: true
  },

  date: { type: String, required: true },

  timeIn: { type: String, default: "" },
  timeOut: { type: String, default: "" },

  totalMinutes: {
    type: Number,
    required: true,
    min: 0,
    max: 180
  },

  totalHours: { type: String, required: true },

  reason: { type: String, default: "" },

  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  },

  createdAt: { type: Date, default: Date.now }

}, { versionKey: false });

module.exports = mongoose.model("PartialLeave", partialLeaveSchema);