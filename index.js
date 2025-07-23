import express from "express";
import { config } from "dotenv";
import StudentRouter from "./routes/student.routes.js";
import AppartmentRouter from "./routes/appartment.routes.js";
import AdminRouter from "./routes/admin.routes.js";
import TutorRouter from "./routes/tutor.routes.js";
import StatisticsRouter from "./routes/statistics.routes.js";
import FilledRouter from "./routes/detail.routes.js";
import NotificationRouter from "./routes/notification.routes.js";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fileUpload from "express-fileupload";

config();

const app = express();
app.use(fileUpload());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static("public"));
app.use(cors({ origin: "*" }));

const port = 7788;
const mongo_url = process.env.MONGO_URI;
mongoose.connect(mongo_url).then(() => {
  console.log("database connected");
});

app.use(StudentRouter);
app.use(AppartmentRouter);
app.use(AdminRouter);
app.use(TutorRouter);
app.use(StatisticsRouter);
app.use(FilledRouter);
app.use(NotificationRouter);

app.get("/", async (req, res) => {
  res.json({ message: "hello" });
});

app.listen(port, () => {
  console.log(`Server has ben started on port ${port}`);
});
