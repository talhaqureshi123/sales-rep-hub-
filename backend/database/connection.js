const mongoose = require("mongoose");
const config = require("../config");

const connectDB = async () => {
  try {
    const uri = config.MONGODB_URI || "";
    const isAtlas = uri.includes("mongodb+srv") || uri.includes("atlas.");
    const options = {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      minPoolSize: 1,
      heartbeatFrequencyMS: 10000,
    };
    if (isAtlas) {
      options.readPreference = "primary";
      options.tls = true;
      options.tlsAllowInvalidCertificates = false;
    }
    const conn = await mongoose.connect(uri, options);

    const isLocal = uri.includes("localhost") || uri.includes("127.0.0.1");
    console.log(`MongoDB Connected: ${conn.connection.host}${isLocal ? " (local)" : " (Atlas)"}`);
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
      console.error("\n💡 Or use local MongoDB (no Atlas needed):");
      console.error("   • Install MongoDB locally, then in backend .env add:");
      console.error("     USE_LOCAL_MONGO=1");
      console.error("   • Optional: MONGODB_URI_LOCAL=mongodb://localhost:27017/salesraphub");
      console.error("   • (Same fix if you see PoolClearedError/ETIMEDOUT at runtime.)");
    } else if (
      error.message.includes("ECONNREFUSED") &&
      (error.message.includes("127.0.0.1") || error.message.includes("localhost") || error.message.includes("::1"))
    ) {
      console.error("\n⚠️  Local MongoDB is not running (connection refused).");
      console.error("\n📋 To fix this:");
      console.error("   • Start MongoDB: run 'mongod' in a terminal, or");
      console.error("   • Windows: Services → start 'MongoDB Server', or");
      console.error("     Run as Admin: net start MongoDB");
      console.error("   • If MongoDB is not installed: https://www.mongodb.com/try/download/community");
      console.error("\n💡 Or use Atlas instead: in backend .env remove or comment out USE_LOCAL_MONGO=1");
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
