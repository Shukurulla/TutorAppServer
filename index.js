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
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ChatRouter from "./routes/chat.routes.js";
import tutorModel from "./models/tutor.model.js";

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
    allowedHeaders: ["Content-Type", "Authorization", "x-requested-with"],
  })
);

// Body parser middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files
app.use("/public", express.static(path.join(__dirname, "public")));

const port = 7788;
const mongo_url = process.env.MONGO_URI;

mongoose
  .connect(mongo_url)
  .then(() => {
    console.log("database connected");
  })
  .catch((error) => {
    console.error("Database connection error:", error);
  });

io.on("connection", (socket) => {
  console.log("Yangi foydalanuvchi ulandi:", socket.id);

  // STUDENT groupName orqali ulanadi
  socket.on("joinGroupRoom", ({ studentId, groupId }) => {
    if (!groupId || !studentId) return;

    const roomName = `group_${groupId}`;
    socket.join(roomName);
    console.log(`Student ${studentId} ${roomName} ga qo‘shildi`);
  });

  // TUTOR xabar yuboradi
  socket.on("sendMessage", async ({ tutorId, message }) => {
    try {
      if (!Array.isArray(groups)) {
        return console.error("Gruppalar massiv bo'lishi kerak");
      }

      const { groups } = await tutorModel.findById(tutorId);

      const messagesToSave = groups.map((group) => ({
        tutorId,
        message,
        group: {
          id: group.id,
          name: group.name,
        },
      }));

      await Chat.insertMany(messagesToSave); // bir nechta hujjatlarni birdaniga qo‘shadi

      // Xabar yuborilayotgan barcha guruhlar uchun xabarni emit qilish
      groups.forEach((group) => {
        socket.to(group.id.toString()).emit("receiveMessage", {
          tutorId,
          message,
          group,
          createdAt: new Date(),
        });
      });
    } catch (error) {
      console.error("Xatolik sendMessage da:", error);
    }
  });
});
// Socket.io ni global qilish (boshqa fayllar uchun)
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

app.get("/", async (req, res) => {
  res.json({ message: "Server is running successfully" });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server Error:", error);
  res.status(500).json({
    status: "error",
    message: error.message || "Internal server error",
  });
});

server.listen(port, () => {
  console.log(`Server has been started on port ${port}`);
});
