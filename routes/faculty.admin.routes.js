// routes/faculty.admin.routes.js
import express from "express";
import facultyAdminModel from "../models/faculty.admin.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";
import StudentModel from "../models/student.model.js";
import bcrypt from "bcrypt";
import AppartmentModel from "../models/appartment.model.js";

const router = express.Router();

// Fakultet admin yaratish (faqat main admin)
router.post("/faculty-admin/create", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, login, password, faculties } = req.body;

    if (
      !firstName ||
      !lastName ||
      !login ||
      !password ||
      !Array.isArray(faculties) ||
      faculties.length === 0
    ) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos, barcha maydonlarni to'liq kiriting",
      });
    }

    // Login unique ekanligini tekshirish
    const existingFacultyAdmin = await facultyAdminModel.findOne({ login });
    if (existingFacultyAdmin) {
      return res.status(400).json({
        status: "error",
        message: "Bu login allaqachon ishlatilgan",
      });
    }

    const facultyAdmin = await facultyAdminModel.create({
      firstName,
      lastName,
      login,
      password, // Hash qilinmaydi
      faculties,
    });

    res.status(200).json({
      status: "success",
      message: "Fakultet admin muvaffaqiyatli yaratildi",
      data: facultyAdmin,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Barcha fakultet adminlarni olish (faqat main admin)
router.get("/faculty-admin/list", authMiddleware, async (req, res) => {
  try {
    const facultyAdmins = await facultyAdminModel.find();
    res.status(200).json({ status: "success", data: facultyAdmins });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Fakultet admin profili (fakultet admin uchun)
router.get("/faculty-admin/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findFacultyAdmin = await facultyAdminModel.findById(userId);

    if (!findFacultyAdmin) {
      return res.status(401).json({
        status: "error",
        message: "Bunday fakultet admin topilmadi",
      });
    }

    res.status(200).json({ status: "success", data: findFacultyAdmin });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Fakultet admin tomonidan tutor yaratish
router.post("/faculty-admin/tutor-create", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findFacultyAdmin = await facultyAdminModel.findById(userId);

    if (!findFacultyAdmin) {
      return res.status(401).json({
        status: "error",
        message: "Siz fakultet admini emassiz",
      });
    }

    const { login, name, phone, password, group } = req.body;

    if (
      !login ||
      !name ||
      !phone ||
      !password ||
      !Array.isArray(group) ||
      group.length === 0
    ) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos, barcha maydonlarni to'liq kiriting",
      });
    }

    // Login unique ekanligini tekshirish
    const existingTutor = await tutorModel.findOne({ login });
    if (existingTutor) {
      return res.status(400).json({
        status: "error",
        message: "Bu login allaqachon ishlatilgan",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const tutor = await tutorModel.create({
      login,
      name,
      phone,
      password: hashedPassword,
      group,
      facultyAdmin: userId,
    });

    res.status(200).json({ status: "success", data: tutor });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Fakultet admin o'zining tutorlarini olish
router.get("/faculty-admin/my-tutors", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findFacultyAdmin = await facultyAdminModel.findById(userId);

    if (!findFacultyAdmin) {
      return res.status(401).json({
        status: "error",
        message: "Bunday fakultet admin topilmadi",
      });
    }

    const findTutors = await tutorModel.find({ facultyAdmin: userId });
    res.status(200).json({ status: "success", data: findTutors });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Fakultetlar ro'yxatini olish (studentlar asosida)
router.get("/faculties", async (req, res) => {
  try {
    const uniqueFaculties = await StudentModel.distinct("department.name");
    const faculties = uniqueFaculties
      .filter((name) => name && name.trim() !== "")
      .map((name) => ({
        name: name,
        code: name.toLowerCase().replace(/\s+/g, "_"),
      }));

    res.json({ status: "success", data: faculties });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Fakultetga tegishli guruhlarni olish
router.get("/faculty-groups/:facultyName", async (req, res) => {
  try {
    const { facultyName } = req.params;

    // Ushbu fakultetdagi studentlarning guruhlarini olish
    const students = await StudentModel.find({
      "department.name": facultyName,
    }).select("group");

    // Takrorlanmas guruhlar ro'yxatini yaratish
    const uniqueGroups = [];
    const seen = new Set();

    students.forEach((student) => {
      if (student.group && student.group.name) {
        const groupKey = `${student.group.name}_${student.group.id}`;
        if (!seen.has(groupKey)) {
          seen.add(groupKey);
          uniqueGroups.push({
            id: student.group.id,
            name: student.group.name,
            educationLang: student.group.educationLang || { name: "O'zbek" },
          });
        }
      }
    });

    res.json({ status: "success", data: uniqueGroups });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
