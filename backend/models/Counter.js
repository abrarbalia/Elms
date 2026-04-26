const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema({
  _id: {
    type: String, // "partialLeave"
    required: true
  },
  seq: {
    type: Number,
    default: 0
  },
  cycle: {
    type: String // "2025-2026"
  }
});

// ✅ FIX (no overwrite error)
module.exports =
  mongoose.models.Counter ||
  mongoose.model("Counter", CounterSchema);