import express from "express";
import adminModel from "../models/admin.model.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/token.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";
import StudentModel from "../models/student.model.js";
const router = express.Router();

router.post("/admin/sign", async (req, res) => {
  try {
    const { username, password } = req.body;
    const findAdmin = await adminModel.findOne({ username });
    if (findAdmin) {
      return res.status(401).json({
        status: "error",
        message: "Bunday username oldin ishlatilgan",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await adminModel.create({
      username,
      password: hashedPassword,
    });

    const token = generateToken(admin._id);

    res.status(200).json({ status: "success", data: admin, token });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const findAdmin = await adminModel.findOne({ username });
    if (!findAdmin) {
      return res.json({
        status: "error",
        message: `${username} nomli admin topilmadi`,
      });
    }
    const compare = await bcrypt.compare(password, findAdmin.password);
    if (!compare) {
      return res
        .status(400)
        .json({ status: "error", message: "Password mos kelmadi" });
    }
    const token = generateToken(findAdmin._id);
    res.status(200).json({ status: "success", data: findAdmin, token });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.get("/admin/tutors", authMiddleware, async (req, res) => {
  try {
    const tutors = await tutorModel.find();

    const students = await StudentModel.find(); // Barcha studentlarni oldik

    const formattedTutors = tutors.map((tutor) => {
      const findStudents = tutor.group.map((item) => {
        const filteredStudents = students.filter(
          (student) => student.group.name === item.name
        );

        return {
          name: item.name,
          faculty: filteredStudents.length > 0 ? filteredStudents[0].faculty.name : "Noma'lum",
          studentCount: filteredStudents.length,
        };
      });

      return {
        _id: tutor._id,
        login: tutor.login,
        name: tutor.name,
        password: tutor.password,
        role: tutor.role,
        createdAt: tutor.createdAt,
        phone: tutor.phone,
        image: tutor.image,
        updatedAt: tutor.updatedAt,
        group: findStudents,
      };
    });

    res.status(200).json({ status: "success", data: formattedTutors });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});


export default router;
