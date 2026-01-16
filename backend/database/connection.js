const mongoose = require("mongoose");
const config = require("../enviornment/config");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 30000, // 30 seconds
      retryWrites: true,
      retryReads: true,
      // MongoDB Atlas specific options
      tls: true,
      tlsAllowInvalidCertificates: false,
      // Connection pool options
      maxPoolSize: 10,
      minPoolSize: 5,
      // Heartbeat to keep connection alive
      heartbeatFrequencyMS: 10000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`\n❌ MongoDB Connection Error: ${error.message}`);

    // Provide helpful error messages based on error type
    if (
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ETIMEOUT")
    ) {
      console.error("\n⚠️  Connection timeout detected. This usually means:");
      console.error(
        "   1. Your IP address is not whitelisted in MongoDB Atlas"
      );
      console.error("   2. Firewall is blocking the connection");
      console.error("   3. Network connectivity issues");
      console.error("\n📋 To fix this:");
      console.error("   • Go to MongoDB Atlas → Network Access");
      console.error(
        "   • Add your current IP address (or 0.0.0.0/0 for development)"
      );
      console.error("   • Wait 1-2 minutes for changes to propagate");
      console.error("   • Check your firewall/antivirus settings");
    } else if (error.message.includes("authentication failed")) {
      console.error(
        "\n⚠️  Authentication failed. Check your MongoDB credentials."
      );
    } else if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("querySrv")
    ) {
      console.error(
        "\n⚠️  DNS resolution failed. Check your internet connection."
      );
    }

    console.error("\nFull error details:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
