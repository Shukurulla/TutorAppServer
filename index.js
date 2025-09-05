import express from "express";
import { config } from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import StudentRouter from "./routes/student.routes.js";
import AppartmentRouter from "./routes/appartment.routes.js";
import AdminRouter from "./routes/admin.routes.js";
import TutorRouter from "./routes/tutor.routes.js";
import StatisticsRouter from "./routes/statistics.routes.js";
import FilledRouter from "./routes/detail.routes.js";
import NotificationRouter from "./routes/notification.routes.js";
import AdsRouter from "./routes/ads.routes.js";
import TutorNotificationRouter from "./routes/tutorNotificaton.routes.js";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ChatRouter from "./routes/chat.routes.js";
import tutorModel from "./models/tutor.model.js";
import chatModel from "./models/chat.model.js";
import StudentModel from "./models/student.model.js";
import axios from "axios";
import { fetchAllStudents } from "./utils/refreshData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

const app = express();
const server = createServer(app);

// Socket.io sozlamalari
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 1e8, // 100MB
});

// CORS sozlamalari
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-requested-with"],
  })
);

// Trust proxy (Nginx uchun)
app.set("trust proxy", 1);

// Request size limitlari - MUHIM!
app.use(
  express.json({
    limit: "1000mb",
    verify: (req, res, buf) => {
      console.log("📦 JSON Body size:", buf.length, "bytes");
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1000mb",
    parameterLimit: 1000000,
    verify: (req, res, buf) => {
      console.log("📦 URL Encoded Body size:", buf.length, "bytes");
    },
  })
);

// Raw body parser (agar kerak bo'lsa)
app.use(
  express.raw({
    limit: "1000mb",
    type: "application/octet-stream",
  })
);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  console.log("🚀 Request Info:", {
    method: req.method,
    url: req.url,
    contentLength: req.get("Content-Length"),
    contentType: req.get("Content-Type"),
    userAgent: req.get("User-Agent")?.substring(0, 50),
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
  });

  // Response bitganda log yozish
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      `✅ Response: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
});

// Static files
app.use("/public", express.static(path.join(__dirname, "public")));

const port = 7788;
const mongo_url = process.env.MONGO_URI;

mongoose
  .connect(mongo_url)
  .then(() => {
    console.log("✅ Database connected");
  })
  .catch((error) => {
    console.error("❌ Database connection error:", error);
  });

// Socket handler
io.on("connection", (socket) => {
  console.log("🔌 Yangi foydalanuvchi ulandi:", socket.id);

  socket.on("joinGroupRoom", ({ studentId, groupId }) => {
    if (!groupId || !studentId) return;
    const roomName = `group_${groupId}`;
    socket.join(roomName);
    console.log(`👤 Student ${studentId} ${roomName} ga qo'shildi`);
  });

  socket.on("sendMessage", async ({ tutorId, message }) => {
    try {
      console.log("📨 Message received:", { tutorId, message });
      const tutor = await tutorModel.findById(tutorId);

      if (!tutor) {
        socket.emit("error", { message: "Tutor topilmadi" });
        return;
      }

      const newMessage = await chatModel.create({
        tutorId,
        message,
        groups: tutor.group.map((group) => ({
          id: group.id,
          name: group.name,
        })),
      });

      tutor.group.forEach((group) => {
        socket.to(`group_${group.id}`).emit("receiveMessage", {
          tutorId,
          message,
          group,
          createdAt: newMessage.createdAt,
        });
      });

      console.log("✅ Message sent successfully");
    } catch (error) {
      console.error("❌ Xatolik sendMessage da:", error);
      socket.emit("error", { message: "Xabar yuborishda xatolik" });
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Foydalanuvchi uzildi:", socket.id);
  });
});

// Socket.io ni global qilish
app.set("io", io);

// Routes
app.use(StudentRouter);
app.use(AppartmentRouter);
app.use(AdminRouter);
app.use(TutorRouter);
app.use(StatisticsRouter);
app.use(FilledRouter);
app.use(NotificationRouter);
app.use(AdsRouter);
app.use(ChatRouter);
app.use("/tutor-notification", TutorNotificationRouter);

app.get("/", async (req, res) => {
  res.json({
    message: "Server is running successfully",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
  });
});

app.get("/get-banners", async (req, res) => {
  const arrBanner = [
    "/public/banner/alert_banner.png",
    "/public/banner/facebook_banner.png",
    "/public/banner/insta_banner.png",
    "/public/banner/telegram_banner.png",
    "/public/banner/website_banner.png",
  ];
  res.status(200).json({ status: "success", data: arrBanner });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
  });
});

// Error handling middleware - ENG OXIRIDA!
app.use((error, req, res, next) => {
  console.error("🔥 Server Error Details:", {
    name: error.name,
    message: error.message,
    code: error.code,
    field: error.field,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });

  // Multer xatoliklari
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      status: "error",
      message: "Fayl hajmi juda katta",
      details: `Maksimal hajm: ${Math.round(error.limit / (1024 * 1024))} MB`,
      code: error.code,
    });
  }

  if (error.code === "LIMIT_FILE_COUNT") {
    return res.status(413).json({
      status: "error",
      message: "Juda ko'p fayl yuklandi",
      details: `Maksimal: ${error.limit} ta fayl`,
      code: error.code,
    });
  }

  if (error.code === "LIMIT_FIELD_VALUE") {
    return res.status(413).json({
      status: "error",
      message: "Field qiymati juda katta",
      code: error.code,
    });
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(413).json({
      status: "error",
      message: "Kutilmagan fayl maydoni",
      field: error.field,
      code: error.code,
    });
  }

  // Express body parser xatoliklari
  if (error.type === "entity.too.large") {
    return res.status(413).json({
      status: "error",
      message: "Request hajmi juda katta",
      limit: error.limit,
      length: error.length,
      type: error.type,
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      status: "error",
      message: "Ma'lumotlarni parse qilishda xatolik",
      type: error.type,
    });
  }

  // MongoDB xatoliklari
  if (error.name === "ValidationError") {
    return res.status(400).json({
      status: "error",
      message: "Ma'lumotlar formati noto'g'ri",
      details: Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      })),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      status: "error",
      message: "Ma'lumot turi noto'g'ri",
      field: error.path,
      value: error.value,
    });
  }

  // Network xatoliklari
  if (error.code === "ECONNRESET") {
    return res.status(408).json({
      status: "error",
      message: "Connection reset - ulanish uzildi",
    });
  }

  if (error.code === "ETIMEDOUT") {
    return res.status(408).json({
      status: "error",
      message: "Request timeout",
    });
  }

  // Umumiy xatolik
  res.status(error.status || 500).json({
    status: "error",
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      details: error,
    }),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route topilmadi",
    path: req.originalUrl,
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("✅ Server closed");
    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("✅ Server closed");
    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    });
  });
});

// Unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("🔥 Uncaught Exception:", error);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`🚀 Server started on port ${port}`);
  console.log(`📊 Memory usage:`, process.memoryUsage());
  console.log(`🕒 Started at:`, new Date().toISOString());
});
