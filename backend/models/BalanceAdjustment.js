const mongoose = require("mongoose");

const balanceAdjustmentSchema = new mongoose.Schema(
  {
    empCode:         { type: Number, required: true },
    leaveType:       { type: String, required: true, uppercase: true, trim: true },
    sessionName:     { type: String, required: true },
    adjustmentValue: { type: Number, required: true }
  },
  { collection: "balance_adjustments", timestamps: true, versionKey: false }
);

module.exports = mongoose.model("BalanceAdjustment", balanceAdjustmentSchema);