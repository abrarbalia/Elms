// const mongoose = require("mongoose");

// const partialLeaveSchema = new mongoose.Schema({
//   empCode: { type: Number, required: true, index: true },
//   name: { type: String, required: true },
//   department: { type: String, required: true },

//   type: {
//     type: String,
//     enum: ["Late", "Early", "Inbetween"],
//     required: true
//   },

//   date: { type: String, required: true },

//   timeIn: { type: String, default: "" },
//   timeOut: { type: String, default: "" },

//   // Official timings
//   officialIn: { type: String,  },
//   officialOut: { type: String, },

//   totalMinutes: {
//     type: Number,
//     required: true,
//     min: 0,
//     max: 180
//   },

//   totalHours: { type: String, required: true },

//   reason: { type: String, default: "" },

//   status: {
//     type: String,
//     enum: ["Pending", "Approved", "Rejected"],
//     default: "Pending"
//   },

//   createdAt: { type: Date, default: Date.now }

// }, { versionKey: false });

// // Prevent duplicate leaves per employee per date
// partialLeaveSchema.index({ empCode: 1, date: 1 }, { unique: true });

// // Export model safely to avoid overwrite errors
// module.exports =
//   mongoose.models.PartialLeave ||
//   mongoose.model("PartialLeave", partialLeaveSchema, "partial_leaves");



const mongoose = require("mongoose");

const partialLeaveSchema = new mongoose.Schema({
   srNo: { type: String, required: true }, // ✅ String for "2025-2026-219" format
  empCode: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  department: { type: String, required: true },

  type: {
    type: String,
    required: true
  },

  date: { type: String, required: true },

  timeIn: { type: String, default: "" },
  timeOut: { type: String, default: "" },

  officialIn: { type: String, default: "" },
  officialOut: { type: String, default: "" },

  totalMinutes: { type: Number, default: 0 },
  totalHours: { type: String, default: "0 hr" },

  reason: { type: String, default: "" },

  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  },

  createdAt: { type: Date, default: Date.now },

  // ── Soft Delete ──────────────────────────────────────────
  isDeleted:  { type: Boolean, default: false, index: true },
  deletedAt:  { type: Date,    default: null },
  deletedBy:  { type: String,  default: '' }

}, { versionKey: false });
// one leave per employee per date
partialLeaveSchema.index({ empCode: 1, date: 1 }, { unique: true });

module.exports =
  mongoose.models.PartialLeave ||
  mongoose.model("PartialLeave", partialLeaveSchema, "partial_leaves");