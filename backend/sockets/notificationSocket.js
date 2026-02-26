const jwt = require("jsonwebtoken");
const config = require("../config");

let _io = null;

/**
 * Notify a user (salesman) that their notifications (tasks/visits/samples) may have changed.
 * Call this after creating/updating FollowUp, VisitTarget, or Sample.
 * @param {string|Object} userId - MongoDB ObjectId or string of the salesman to notify
 */
function notifyUser(userId) {
  if (!_io || !userId) return;
  const id = typeof userId === "object" && userId?.toString ? userId.toString() : String(userId);
  if (!id) return;
  _io.to("user-" + id).emit("notification-update");
}

/**
 * Attach Socket.IO and auth. Call once from server.js after creating the Server.
 * @param {import("socket.io").Server} io
 */
function init(io) {
  _io = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Auth required"));
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      socket.userId = decoded.userId || decoded.id || decoded._id;
      if (!socket.userId) return next(new Error("Invalid token"));
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const uid = typeof socket.userId === "object" && socket.userId?.toString
      ? socket.userId.toString()
      : String(socket.userId);
    socket.join("user-" + uid);
  });
}

module.exports = { init, notifyUser };
