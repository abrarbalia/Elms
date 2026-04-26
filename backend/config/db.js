const mongoose = require("mongoose");

async function connectDB() {
  try {
    const uri = process.env.MONGO_URI || "mongodb://Elms:FGaBrIn63uPDG57p@ac-duktgap-shard-00-00.umivhxn.mongodb.net:27017,ac-duktgap-shard-00-01.umivhxn.mongodb.net:27017,ac-duktgap-shard-00-02.umivhxn.mongodb.net:27017/employeeDB?ssl=true&authSource=admin";
    
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
      family: 4
    });
    
    console.log("MongoDB Connected ✅");
  } catch (error) {
    console.error("MongoDB Connection Failed ❌:", error.message);
  }
}

module.exports = { connectDB };