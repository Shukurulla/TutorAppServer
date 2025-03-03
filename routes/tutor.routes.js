import express from "express";
import tutorModel from "../models/tutor.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import adminModel from "../models/admin.model.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/token.js";
import StudentModel from "../models/student.model.js";
import bcrypt from "bcrypt";
const router = express.Router();

router.post("/tutor/create", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { login, password, group } = req.body;
    const findAdmin = await adminModel.findById(userId);
    if (!findAdmin) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday admin topilmadi" });
    }

    if (!login || !password || !group) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos Malumotlarni toliq kiriting",
      });
    }

    const findTutor = await tutorModel.findOne({ login });
    if (findTutor) {
      return res.status(400).json({
        status: "error",
        message: "bunday tutor oldin royhatdan otgan",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const tutor = await tutorModel.create({
      login,
      group,
      password: hashedPassword,
    });

    res.status(200).json({ status: "success", data: tutor });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.post("/tutor/login", async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos Malumotlarni toliq kiriting",
      });
    }
    const findTutor = await tutorModel.findOne({ login });
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const compare = await bcrypt.compare(password, findTutor.password);
    if (!compare) {
      return res
        .status(400)
        .json({ status: "error", message: "Password mos kelmadi" });
    }

    const token = generateToken(findTutor._id);
    res.status(200).json({ status: "success", data: findTutor, token });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.get("/tutor/my-students", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const group = findTutor.group;
    const findStudents = await StudentModel.find({ "group.name": group });

    res.status(201).json({ status: "success", data: findStudents });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/tutor/change-password", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findTutor = await tutorModel.findById(userId);

    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const { confirmPassword, newPassword } = req.body;

    const comparePassword = await bcrypt.compare(
      confirmPassword,
      findTutor.password
    );
    if (!comparePassword) {
      return res
        .status(401)
        .json({ status: "error", message: "Password togri kelmadi" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const changeTutorData = await tutorModel.findByIdAndUpdate(
      findTutor,
      {
        $set: {
          password: hashedPassword,
        },
      },
      { new: true }
    );

    res
      .status(201)
      .json({
        status: "success",
        data: changeTutorData,
        message: "Password muaffaqiyatli ozgartirildi!",
      });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});



export default router;
