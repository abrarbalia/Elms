const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Counter = require("./models/Counter");

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const currentCycle = "2025-2026";
    const startSeq = 218; // Next will be 219

    await Counter.findOneAndUpdate(
      { _id: "partialLeave" },
      { $set: { cycle: currentCycle, seq: startSeq } },
      { upsert: true, new: true }
    );

    console.log(`Counter seeded: _id: partialLeave, cycle: ${currentCycle}, seq: ${startSeq}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
