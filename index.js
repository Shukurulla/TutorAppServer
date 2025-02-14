import express from "express";
import { config } from "dotenv";
import StudentRouter from "./routes/student.routes.js";
import AppartmentRouter from "./routes/appartment.routes.js";
import AdminRouter from "./routes/admin.routes.js";
import TutorRouter from "./routes/tutor.routes.js";
import mongoose from "mongoose";
import cors from "cors";
config();

const app = express();
const port = process.env.PORT;
const mongo_url = process.env.MONGO_URI;

mongoose.connect(mongo_url).then(() => {
  console.log("database connected");
});

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(StudentRouter);
app.use(AppartmentRouter);
app.use(AdminRouter);
app.use(TutorRouter);
app.get("/", async (req, res) => {
  res.json({ message: "hello" });
});

app.listen(port, () => {
  console.log(`Server has ben started on port ${port}`);
});
