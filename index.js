const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { userRouter } = require("./src/routes/users");
const { roomRouter } = require("./src/routes/rooms");
const { chatRouter } = require("./src/routes/chats");
const { AuthenticationHandler } = require("./src/middleware/authentication");
const { updateRoomStatus } = require("./src/services/roomStatusService");
const { roomModel } = require("./src/models/Room");
const { chatModel } = require("./src/models/Chat");

dotenv.config();

// Initialize Express app and server
const app = express();
const server = http.createServer(app);

// Enable WebSocket
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Attach io instance to request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Enable CORS and JSON parsing
app.use(cors({ origin: "*" }));
app.use(express.json());

// Public routes
app.use("/users", userRouter);

// Protected routes
app.use(AuthenticationHandler);
app.use("/rooms", roomRouter);
app.use("/chats", chatRouter);

// Periodically update room status
setInterval(updateRoomStatus, 60 * 1000);

// ============================
// SOCKET.IO AUTH MIDDLEWARE
// ============================
// io.use((socket, next) => {
//   const token = socket.handshake.auth.token;

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
//     socket.userId = decoded.id;
//     next();
//   } catch (err) {
//     console.error("Socket authentication error:", err.message);
//     next(new Error("Authentication error"));
//   }
// });

// ============================
// SOCKET.IO EVENTS
// ============================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Register user for private notifications
  socket.on("register", (userId) => {
    try {
      socket.userId = userId;
      socket.join(userId); // Join the user to their private room for notifications
      console.log(`User ${userId} registered for notifications`);
    } catch (err) {
      console.error("register error:", err);
      socket.emit("errorOccurred", { message: "Failed to register user." });
    }
  });

  // Join a specific room
  socket.on("joinRoom", async ({ roomId, userId }) => {
    try {
      const room = await roomModel.findById(roomId);
      if (!room) {
        socket.emit("joinRoomError", { message: "Room not found." });
        return;
      }

      if (room.status !== "live") {
        socket.emit("joinRoomError", { message: "Room is not live." });
        return;
      }

      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);

      // Update participant count
      const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      io.to(roomId).emit("participantCountUpdate", { roomId, count });
    } catch (err) {
      console.error("joinRoom error:", err);
      socket.emit("joinRoomError", { message: "Internal error." });
    }
  });

  // Leave a specific room
  socket.on("leaveRoom", (roomId) => {
    try {
      socket.leave(roomId);
      // Update participant count when a user leaves
      const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      io.to(roomId).emit("participantCountUpdate", { roomId, count });
    } catch (err) {
      console.error("leaveRoom error:", err);
      socket.emit("errorOccurred", { message: "Failed to leave room." });
    }
  });

  // Send a new chat message
  socket.on("sendMessage", async (data) => {
    try {
      const { roomId, message, type, senderId } = data;

      // Ensure the message is not empty
      if (!message.trim()) {
        socket.emit("errorOccurred", { message: "Message cannot be empty." });
        return;
      }

      // Create and save the chat message to the database
      const newChat = new chatModel({
        roomId,
        sender: senderId,
        message,
        type,
      });

      await newChat.save();

      // Broadcast the message to all users in the room
      io.to(roomId).emit("receiveMessage", {
        senderId,
        message,
        type,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error("sendMessage error:", err);
      socket.emit("errorOccurred", { message: "Failed to send message." });
    }
  });

  // Handle user disconnections and update participant count
  socket.on("disconnecting", () => {
    try {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          const count = (io.sockets.adapter.rooms.get(roomId)?.size || 1) - 1;
          io.to(roomId).emit("participantCountUpdate", { roomId, count });
        }
      }
    } catch (err) {
      console.error("disconnecting error:", err);
    }
  });

  // Handle the actual disconnection event
  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id} due to ${reason}`);
  });

  // General error handling for socket
  socket.on("error", (err) => {
    console.error("Socket error caught:", err);
    socket.emit("errorOccurred", { message: "An unexpected error occurred." });
  });
});
// ============================
// GLOBAL CRASH PROTECTION
// ============================
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Optional: exit process, restart, or alert monitoring
});

// ============================
// START SERVER
// ============================
const PORT = process.env.SERVER_PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
