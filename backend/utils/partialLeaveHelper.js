const Counter = require("../models/Counter");

/**
 * Get current academic cycle (June 1st to May 31st)
 */
function getCurrentCycle() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // Jan = 1
  let startYear, endYear;
  if (month >= 6) {
    startYear = year;
    endYear = year + 1;
  } else {
    startYear = year - 1;
    endYear = year;
  }
  return `${startYear}-${endYear}`;
}

/**
 * Atomic SR number generation: YYYY-YYYY-XXX
 */
async function getNextSrNo() {
  const currentCycle = getCurrentCycle();

  // Find and update atomically
  // If cycle mismatch, we reset seq to 1.
  // Note: Simple findByIdAndUpdate with $inc doesn't handle cycle resets automatically in one call
  // unless we use a more complex aggregation or handle it in two steps with a lock.
  // Given the scale, a two-step check is usually safe if we handle the initialization.

  let counter = await Counter.findById("partialLeave");

  if (!counter || counter.cycle !== currentCycle) {
    // Reset or Initialize
    // We use { upsert: true, new: true } to handle race conditions during initialization
    counter = await Counter.findOneAndUpdate(
      { _id: "partialLeave" },
      { $set: { cycle: currentCycle, seq: 1 } },
      { upsert: true, new: true }
    );
  } else {
    // Increment atomically
    counter = await Counter.findOneAndUpdate(
      { _id: "partialLeave", cycle: currentCycle },
      { $inc: { seq: 1 } },
      { new: true }
    );

    // If counter became null (someone else changed the cycle just now), retry
    if (!counter) return getNextSrNo();
  }

  const paddedSeq = String(counter.seq).padStart(3, '0');
  return `${currentCycle}-${paddedSeq}`;
}

/**
 * Convert HH:mm → minutes
 */
function toMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Round to nearest 30 minutes, max 180
 */
function roundToThirty(minutes) {
  let rounded = Math.ceil(minutes / 30) * 30;
  if (rounded < 30) rounded = 30;
  if (rounded > 180) rounded = 180;
  return rounded;
}

/**
 * Format minutes → "X hr" or "X.5 hr"
 */
function formatHours(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h}.5 hr`;
}

module.exports = {
  getCurrentCycle,
  getNextSrNo,
  toMinutes,
  roundToThirty,
  formatHours
};
