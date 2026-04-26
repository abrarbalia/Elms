const mongoose = require("mongoose");

const adminUserSchema = new mongoose.Schema({
  "Employee Code": { type: Number, required: true },
  "Name": { type: String, required: true },
  "Email": { type: String, required: true },
  "Password": { type: Number, required: true },
  "role": { type: String, default: "Employee" },
  "department": String,
  "leaveBalance": { type: Number, default: 30 },
  "dept_code": Number
}, { timestamps: true });

// 👇 Force collection name (avoid auto pluralization)
module.exports = mongoose.model("AdminUser", adminUserSchema, "adminusers");