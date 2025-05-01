const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");

// Connection configuration
const DB_URL = process.env.DB_URL;

if (!DB_URL) {
  throw new Error("DB_URL is not defined in environment variables");
}

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
};

// Store the connection promise
const connectionPromise = mongoose.connect(DB_URL);

// Event handlers
mongoose.connection.on("connected", () => {
  console.log(`MongoDB connected to ${mongoose.connection.name}`);
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

// Export the connection promise and mongoose
module.exports = {
  mongoose,
  connection: connectionPromise,
};
