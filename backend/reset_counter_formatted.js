const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
  cycle: { type: String }
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

async function resetCounter() {
  try {
    const uri = process.env.MONGO_URI || "mongodb://Elms:FGaBrIn63uPDG57p@ac-duktgap-shard-00-00.umivhxn.mongodb.net:27017,ac-duktgap-shard-00-01.umivhxn.mongodb.net:27017,ac-duktgap-shard-00-02.umivhxn.mongodb.net:27017/employeeDB?ssl=true&authSource=admin";
    
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let startYear, endYear;
    if (month >= 6) {
      startYear = year;
      endYear = year + 1;
    } else {
      startYear = year - 1;
      endYear = year;
    }
    const currentCycle = `${startYear}-${endYear}`;
    
    // Set counter to 218 for the current year, so next is 219
    const result = await Counter.findByIdAndUpdate(
      'partialLeave',
      { seq: 218, cycle: currentCycle },
      { upsert: true, new: true }
    );
    
    console.log('Counter updated successfully:');
    console.log(JSON.stringify(result, null, 2));
    console.log(`Next SrNo will be: ${currentCycle}-219`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error resetting counter:', err);
    process.exit(1);
  }
}

resetCounter();
