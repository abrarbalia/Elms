const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sessionName: { type: String, required: true },
    startDate:   { type: String, required: true },
    endDate:     { type: String, required: true }
  },
  { collection: "active_sessions", timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Session", sessionSchema);