// index.js (yangilangan qism - faqat import va route qo'shish)
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
import FacultyAdminRouter from "./routes/faculty.admin.routes.js"; // YANGI QOSHILDI

import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ChatRouter from "./routes/chat.routes.js";
import tutorModel from "./models/tutor.model.js";
import chatModel from "./models/chat.model.js";
import StudentModel from "./models/student.model.js";
import axios from "axios";
import { autoRefreshStudentData } from "./utils/refreshData.js";
import PermissionRouter from "./routes/permission.routes.js";
import permissionModel from "./models/permission.model.js";

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
});

// CORS sozlamalari
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  })
);

// Body parser limitlari
app.use(
  express.json({
    limit: "100mb",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "100mb",
    parameterLimit: 50000,
  })
);

// Static files
app.use("/public", express.static(path.join(__dirname, "public")));

const port = 7788;
const mongo_url = process.env.MONGO_URI;

mongoose
  .connect(mongo_url)
  .then(async () => {
    console.log("✅ Database connected successfully");
  })
  .catch((error) => {
    console.error("❌ Database connection error:", error);
  });

// Socket handler (o'zgarishsiz qoladi)
io.on("connection", (socket) => {
  console.log("Yangi foydalanuvchi ulandi:", socket.id);

  socket.on("joinGroupRoom", ({ studentId, groupId }) => {
    if (!groupId || !studentId) return;

    const roomName = `group_${groupId}`;
    socket.join(roomName);
    console.log(`Student ${studentId} ${roomName} ga qo'shildi`);
  });

  socket.on("sendMessage", async ({ tutorId, message }) => {
    try {
      console.log({ tutorId, message });

      const tutor = await tutorModel.findById(tutorId);
      console.log(tutor);

      const newMessage = await chatModel.create({
        tutorId,
        message,
        groups: tutor.group.map((group) => ({
          id: group.code,
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

      console.log(newMessage);
    } catch (error) {
      console.error("Xatolik sendMessage da:", error);
    }
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
app.use("/permission", PermissionRouter);
app.use("/faculty-admin", FacultyAdminRouter); // YANGI ROUTE QOSHILDI

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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server Error:", error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      status: "error",
      message: "Fayl hajmi juda katta",
      maxSize: "100MB",
    });
  }

  if (error.code === "LIMIT_FILE_COUNT") {
    return res.status(413).json({
      status: "error",
      message: "Juda ko'p fayl yuklandi",
    });
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(413).json({
      status: "error",
      message: "Kutilmagan fayl maydoni",
      field: error.field,
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      status: "error",
      message: "Request hajmi juda katta",
    });
  }

  res.status(500).json({
    status: "error",
    message: error.message || "Internal server error",
  });
});

server.listen(port, () => {
  console.log(`Server has been started on port ${port}`);
});
