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
import { fixExistingStudentData } from "./utils/fixStudentData.js";
// import migrateStudents from "./utils/migration.js";

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

// index.js - mongoose connect qismidan keyin
mongoose
  .connect(mongo_url)
  .then(async () => {
    console.log("✅ Database connected successfully");

    // Index allaqachon mavjud bo'lsa xatolik bermaydi
    try {
      const indexExists = await StudentModel.collection.indexExists(
        "student_id_number_1"
      );
      if (!indexExists) {
        await StudentModel.collection.createIndex({ student_id_number: 1 });

        console.log("✅ Index created");
      } else {
        console.log("ℹ️ Index already exists");
      }
    } catch (error) {
      // Index xatosini e'tiborsiz qoldirish
      if (error.code !== 86) {
        console.error("Index error:", error);
      }
    }
  })
  .catch((error) => {
    console.error("❌ Database connection error:", error);
  });

// Socket handler (o'zgarishsiz qoladi)
io.on("connection", (socket) => {
  console.log("✅ Yangi foydalanuvchi ulandi:", socket.id);

  // Student o'z shaxsiy xonasiga qo'shiladi
  socket.on("joinStudentRoom", ({ studentId }) => {
    if (!studentId) {
      console.log("❌ Student ID topilmadi");
      return;
    }

    const roomName = `student_${studentId}`;
    socket.join(roomName);
    console.log(
      `📌 Student ${studentId} shaxsiy xonaga qo'shildi: ${roomName}`
    );
  });

  // Student guruh xonasiga qo'shiladi
  socket.on("joinGroupRoom", ({ studentId, groupId }) => {
    if (!groupId || !studentId) {
      console.log("❌ Group ID yoki Student ID topilmadi");
      return;
    }

    const roomName = `group_${groupId}`;
    socket.join(roomName);
    console.log(
      `📌 Student ${studentId} guruh xonasiga qo'shildi: ${roomName}`
    );
  });

  // Tutor xabar yuborishi
  socket.on(
    "sendMessage",
    async ({ tutorId, message, targetType, targets }) => {
      try {
        console.log("📨 Xabar yuborish so'rovi:", {
          tutorId,
          targetType,
          targets,
        });

        const tutor = await tutorModel.findById(tutorId);
        if (!tutor) {
          socket.emit("error", { message: "Tutor topilmadi" });
          return;
        }

        let messageData = {
          tutorId,
          message,
          groups: [],
          students: [],
        };

        // Maqsadli auditoriyaga qarab xabar yuborish
        if (targetType === "groups" && targets && targets.length > 0) {
          // Guruhlar uchun xabar
          messageData.groups = targets.map((groupId) => {
            const group = tutor.group.find((g) => g.code === parseInt(groupId));
            return {
              id: parseInt(groupId),
              name: group ? group.name : `Group ${groupId}`,
            };
          });

          // Har bir guruhga xabar yuborish
          for (const groupId of targets) {
            const roomName = `group_${groupId}`;
            io.to(roomName).emit("receiveMessage", {
              tutorId,
              tutorName: tutor.name || "Tutor",
              message,
              targetType: "group",
              groupId: parseInt(groupId),
              createdAt: new Date(),
            });
            console.log(`✉️ Guruhga xabar yuborildi: ${roomName}`);
          }
        } else if (targetType === "students" && targets && targets.length > 0) {
          // Studentlar uchun xabar
          messageData.students = targets.map((studentId) => ({
            id: studentId,
          }));

          // Har bir studentga shaxsiy xabar yuborish
          for (const studentId of targets) {
            const roomName = `student_${studentId}`;
            io.to(roomName).emit("receiveMessage", {
              tutorId,
              tutorName: tutor.name || "Tutor",
              message,
              targetType: "personal",
              studentId,
              createdAt: new Date(),
            });
            console.log(`✉️ Studentga shaxsiy xabar yuborildi: ${roomName}`);
          }
        } else if (targetType === "all") {
          // Barcha guruhlar uchun xabar (eski usul)
          messageData.groups = tutor.group.map((group) => ({
            id: group.code,
            name: group.name,
          }));

          // Barcha guruhlarga xabar yuborish
          tutor.group.forEach((group) => {
            const roomName = `group_${group.code}`;
            io.to(roomName).emit("receiveMessage", {
              tutorId,
              tutorName: tutor.name || "Tutor",
              message,
              targetType: "group",
              groupId: group.code,
              groupName: group.name,
              createdAt: new Date(),
            });
            console.log(`✉️ Guruhga xabar yuborildi: ${roomName}`);
          });
        }

        // Xabarni bazaga saqlash
        const newMessage = await chatModel.create(messageData);

        // Tutorga tasdiqlash
        socket.emit("messageSent", {
          success: true,
          messageId: newMessage._id,
          message: "Xabar muvaffaqiyatli yuborildi",
        });

        console.log("✅ Xabar bazaga saqlandi:", newMessage._id);
      } catch (error) {
        console.error("❌ Xatolik sendMessage da:", error);
        socket.emit("error", {
          message: "Xabar yuborishda xatolik",
          error: error.message,
        });
      }
    }
  );

  // Socket uzilganda
  socket.on("disconnect", () => {
    console.log("👋 Foydalanuvchi uzildi:", socket.id);
  });

  // Xabarni o'chirish (real-time)
  socket.on("deleteMessage", async ({ messageId, tutorId }) => {
    try {
      const message = await chatModel.findOne({ _id: messageId, tutorId });
      if (!message) {
        socket.emit("error", { message: "Xabar topilmadi" });
        return;
      }

      // Xabarni o'chirish
      await chatModel.findByIdAndDelete(messageId);

      // Tegishli xonalarga o'chirish haqida xabar
      if (message.groups && message.groups.length > 0) {
        message.groups.forEach((group) => {
          io.to(`group_${group.id}`).emit("messageDeleted", { messageId });
        });
      }

      if (message.students && message.students.length > 0) {
        message.students.forEach((student) => {
          io.to(`student_${student.id}`).emit("messageDeleted", { messageId });
        });
      }

      socket.emit("messageDeleted", {
        success: true,
        messageId,
        message: "Xabar o'chirildi",
      });
    } catch (error) {
      console.error("❌ Xabar o'chirishda xatolik:", error);
      socket.emit("error", {
        message: "Xabar o'chirishda xatolik",
        error: error.message,
      });
    }
  });

  // Xabarni tahrirlash (real-time)
  socket.on("editMessage", async ({ messageId, newMessage, tutorId }) => {
    try {
      const message = await chatModel.findOne({ _id: messageId, tutorId });
      if (!message) {
        socket.emit("error", { message: "Xabar topilmadi" });
        return;
      }

      // Xabarni yangilash
      message.message = newMessage;
      await message.save();

      // Tegishli xonalarga yangilangan xabar
      const updateData = {
        messageId,
        newMessage,
        updatedAt: new Date(),
      };

      if (message.groups && message.groups.length > 0) {
        message.groups.forEach((group) => {
          io.to(`group_${group.id}`).emit("messageEdited", updateData);
        });
      }

      if (message.students && message.students.length > 0) {
        message.students.forEach((student) => {
          io.to(`student_${student.id}`).emit("messageEdited", updateData);
        });
      }

      socket.emit("messageEdited", {
        success: true,
        ...updateData,
        message: "Xabar tahrirlandi",
      });
    } catch (error) {
      console.error("❌ Xabar tahrirlashda xatolik:", error);
      socket.emit("error", {
        message: "Xabar tahrirlashda xatolik",
        error: error.message,
      });
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
