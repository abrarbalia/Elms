const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  dept_code: {         // 🔹 Must match User.dept_code
    type: Number,
    required: true,
    unique: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  }
}, { timestamps: true });

// ✅ Export model
module.exports =
  mongoose.models.Department ||
  mongoose.model("Department", departmentSchema, "departments");