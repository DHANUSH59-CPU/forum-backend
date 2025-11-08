// -------------------------------
// 🌍 IMPORTS
// -------------------------------
import dotenv from "dotenv";
dotenv.config(); // Load .env before anything else

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import User from "./models/User.js";

// -------------------------------
// 🚀 EXPRESS APP SETUP
// -------------------------------
const app = express();
const server = http.createServer(app);

// -------------------------------
// ⚙️ MIDDLEWARE
// -------------------------------
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// -------------------------------
// 🧩 SOCKET.IO SETUP
// -------------------------------
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ✅ Socket Authentication (verify JWT from token or cookie)
io.use(async (socket, next) => {
  try {
    // Try to get token from auth object first, then from cookies
    let token = socket.handshake.auth?.token;
    
    // If no token in auth, try to get from cookies
    if (!token) {
      const cookieHeader = socket.handshake.headers.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split("=");
          if (name && value) {
            acc[name] = decodeURIComponent(value);
          }
          return acc;
        }, {});
        token = cookies.token;
      }
    }

    if (!token) {
      return next(new Error("Unauthorized: No token"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || process.env.JWT_SECRET_KEY
    );
    const user = await User.findById(decoded.id || decoded.userId);

    if (!user) return next(new Error("Unauthorized: User not found"));

    socket.user = { id: user._id, name: user.name, email: user.email };
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    next(new Error("Unauthorized"));
  }
});

// ✅ Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`⚡ User connected: ${socket.user?.name || socket.id}`);

  // Join a post room to receive updates for that post
  socket.on("joinPost", (postId) => {
    socket.join(postId);
    console.log(`📄 ${socket.user?.name || "User"} joined room: ${postId}`);
  });

  // Leave a post room
  socket.on("leavePost", (postId) => {
    socket.leave(postId);
    console.log(`📄 ${socket.user?.name || "User"} left room: ${postId}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.user?.name || socket.id}`);
  });
});

// ✅ Make io available in routes/controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// -------------------------------
// 🧭 ROUTES
// -------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("✅ Learnato Forum backend is running...");
});

// -------------------------------
// 🧱 DATABASE & SERVER START
// -------------------------------
const PORT = process.env.PORT || 5000;

connectDB();

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// -------------------------------
// 🧹 GRACEFUL SHUTDOWN
// -------------------------------
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed.");
      process.exit(0);
    });
  });
});
