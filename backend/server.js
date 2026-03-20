const http = require("http");
const app = require("./app");
const config = require("./config");
const { Server } = require("socket.io");
const { init: initNotificationSocket } = require("./sockets/notificationSocket");

const PORT = config.PORT || 4000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000,
});
initNotificationSocket(io);

server.listen(PORT, () => {
  console.log(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
  const orderTo = (config.ORDER_NOTIFY_EMAIL || process.env.ORDER_NOTIFY_EMAIL || "").trim() || "accounts@praco.co.uk (fallback)";
  const orderFrom = (config.SALES_ORDER_FROM_EMAIL || config.INFO_PROCO_EMAIL || process.env.INFO_PROCO_EMAIL || "").trim() ? "set" : "NOT SET";
  console.log(`📧 Order email: To=${orderTo}, From=${orderFrom}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});


