const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  "Employee Code": {
    type: Number,
    required: true,
    unique: true
  },

  Name: {
    type: String,
    required: true
  },

  Email: {
    type: String,
    required: true
  },

  Password: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  role: {
    type: String
  },

  department: {
    type: String
  },

  dept_code: {
    type: Number,
    required: true
  },
  
  staffType: {
    type: String,
    enum: ["Teaching", "Non-Teaching", "All"],
    default: "Teaching"
  },

  startTime: {
    type: String,
    default: "09:00"
  },

  endTime: {
    type: String,
    default: "18:00"
  }

}, { timestamps: true });

module.exports =
  mongoose.models.User ||
  mongoose.model("User", UserSchema, "users");