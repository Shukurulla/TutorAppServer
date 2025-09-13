import express from "express";
import tutorModel from "../models/tutor.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import adminModel from "../models/admin.model.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/token.js";
import StudentModel from "../models/student.model.js";
import AppartmentModel from "../models/appartment.model.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import NotificationModel from "../models/notification.model.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";
import axios from "axios";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Student ma'lumotlarini tozalash va formatlash funksiyasi
router.post("/student/sign", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({
      status: "error",
      message: "Login va parol kiritish majburiy",
    });
  }

  // 🔐 HEMIS login
  let tokenData;
  try {
    const { data } = await axios.post(
      `${process.env.HEMIS_API_URL}/auth/login`,
      { login, password },
      {
        timeout: 5000,
        headers: { "Content-Type": "application/json" },
      }
    );
    tokenData = data;
  } catch (err) {
    return res.status(401).json({
      status: "error",
      message: "Login yoki parol noto‘g‘ri (HEMIS).",
    });
  }

  // 🔎 HEMIS account
  let account;
  try {
    const response = await axios.get(
      `${process.env.HEMIS_API_URL}/account/me`,
      {
        headers: { Authorization: `Bearer ${tokenData.data.token}` },
        timeout: 5000,
      }
    );
    account = response.data;
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "HEMIS tizimidan ma'lumot olishda xatolik yuz berdi",
    });
  }

  if (!account || !account.data) {
    return res.status(500).json({
      status: "error",
      message: "HEMIS tizimidan ma'lumot kelmadi",
    });
  }

  try {
    // Studentni local bazadan olish
    const findStudent = await StudentModel.findOne({
      student_id_number: account.data.student_id_number,
    }).lean();

    if (!findStudent) {
      return res.status(404).json({
        status: "error",
        message:
          "HEMIS login/parol to'g'ri, ammo local bazada bunday student topilmadi.",
      });
    }

    // Yotoqxona bor-yo‘qligini tekshirish
    const existAppartment = await AppartmentModel.findOne({
      studentId: findStudent._id,
    }).lean();

    const token = generateToken(findStudent._id);

    // 🔑 faqat kerakli fieldlarni qaytaramiz
    const filteredStudent = {
      _id: findStudent._id,
      id: findStudent.id,
      university: findStudent.university,
      full_name: findStudent.full_name,
      short_name: findStudent.short_name,
      first_name: findStudent.first_name,
      second_name: findStudent.second_name,
      third_name: findStudent.third_name,
      gender: findStudent.gender,
      birth_date: findStudent.birth_date,
      student_id_number: findStudent.student_id_number,
      image: findStudent.image,
      avg_gpa: findStudent.avg_gpa,
      avg_grade: findStudent.avg_grade,
      total_credit: findStudent.total_credit,
      country: findStudent.country,
      province: findStudent.province,
      currentProvince: findStudent.currentProvince,
      district: findStudent.district,
      currentDistrict: findStudent.currentDistrict,
      terrain: findStudent.terrain,
      currentTerrain: findStudent.currentTerrain,
      citizenship: findStudent.citizenship,
      studentStatus: findStudent.studentStatus,
      _curriculum: findStudent._curriculum,
      educationForm: findStudent.educationForm,
      educationType: findStudent.educationType,
      paymentForm: findStudent.paymentForm,
      studentType: findStudent.studentType,
      socialCategory: findStudent.socialCategory,
      accommodation: findStudent.accommodation,
      department: findStudent.department,
      specialty: findStudent.specialty,
      group: findStudent.group,
      level: findStudent.level,
      semester: findStudent.semester,
      educationYear: findStudent.educationYear,
      year_of_enter: findStudent.year_of_enter,
      roommate_count: findStudent.roommate_count,
      is_graduate: findStudent.is_graduate,
      total_acload: findStudent.total_acload,
      other: findStudent.other,
      created_at: findStudent.created_at,
      updated_at: findStudent.updated_at,
      hash: findStudent.hash,
      validateUrl: findStudent.validateUrl,
      __v: findStudent.__v,
      existAppartment: !!existAppartment,
    };

    return res.status(200).json({
      status: "success",
      student: filteredStudent,
      hemisData: null,
      token,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "So‘rovni bajarishda xatolik yuz berdi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Appartment mavjudligini tekshirish
router.get("/student/existAppartment", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "Foydalanuvchi ID topilmadi",
      });
    }

    const findAppartment = await AppartmentModel.findOne({
      studentId: userId,
    });

    res.status(200).json({
      status: "success",
      exist: !!findAppartment,
      apartmentId: findAppartment?._id || null,
    });
  } catch (error) {
    console.error("Error checking apartment existence:", error);
    res.status(500).json({
      status: "error",
      message: "Ijara ma'lumotlarini tekshirishda xatolik",
    });
  }
});

// Test uchun student yaratish
router.post("/student/create-byside", async (req, res) => {
  try {
    console.log("🧪 Creating test student...");
    const cleanedData = cleanStudentData(req.body);
    const student = await StudentModel.create(cleanedData);

    console.log("✅ Test student created:", student.student_id_number);
    res.status(201).json({
      status: "success",
      message: "Test student yaratildi",
      student: student,
    });
  } catch (error) {
    console.error("❌ Create test student error:", error);
    res.status(500).json({
      status: "error",
      message: "Test student yaratishda xatolik",
      details: error.name === "ValidationError" ? error.errors : undefined,
    });
  }
});

// Student notification olish
router.get("/student/notification/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const findStudent = await StudentModel.findById(id);
    if (!findStudent) {
      return res.status(404).json({
        status: "error",
        message: "Bunday student topilmadi",
      });
    }

    const appartments = await AppartmentModel.find({
      studentId: id,
      view: false,
    }).sort({ createdAt: -1 });

    const notifications = appartments
      .filter((c) => c.status !== "Being checked")
      .map((item) => ({
        status: item.status,
        apartmentId: item._id,
        createdAt: item.createdAt,
      }));

    res.status(200).json({
      status: "success",
      data: notifications,
      total: notifications.length,
    });
  } catch (error) {
    console.error("Error getting student notifications:", error);
    res.status(500).json({
      status: "error",
      message: "Notificationlarni olishda xatolik",
    });
  }
});

// Student profil ma'lumotlari
router.get("/student/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const findStudent = await StudentModel.findById(userId).select(
      "gender province image full_name first_name second_name student_id_number group level department"
    );

    if (!findStudent) {
      return res.status(404).json({
        status: "error",
        message: "Bunday student topilmadi",
      });
    }

    const profileData = {
      id: findStudent._id,
      fullName: findStudent.full_name,
      firstName: findStudent.first_name,
      secondName: findStudent.second_name,
      studentIdNumber: findStudent.student_id_number,
      gender: findStudent.gender,
      province: findStudent.province?.name || "Noma'lum",
      image: findStudent.image || null,
      group: findStudent.group?.name || "Noma'lum",
      level: findStudent.level?.name || "Noma'lum",
      department: findStudent.department?.name || "Noma'lum",
    };

    res.status(200).json({
      status: "success",
      data: profileData,
    });
  } catch (error) {
    console.error("Error getting student profile:", error);
    res.status(500).json({
      status: "error",
      message: "Profil ma'lumotlarini olishda xatolik",
    });
  }
});

// Tutor profil yangilash (bu endpoint student routes da nima qilyapti?)
router.put(
  "/tutor/profile",
  authMiddleware,
  uploadSingleImage,
  async (req, res) => {
    try {
      const { userId } = req.userData;
      const findTutor = await tutorModel.findById(userId);

      if (!findTutor) {
        return res.status(404).json({
          status: "error",
          message: "Bunday tutor topilmadi",
        });
      }

      const updateFields = {};
      const { login, name, phone, group } = req.body;

      if (login) updateFields.login = login;
      if (name) updateFields.name = name;
      if (phone) updateFields.phone = phone;
      if (group) updateFields.group = JSON.parse(group);

      // Fayl yuklash
      if (req.file) {
        updateFields.image = `/public/images/${req.file.filename}`;

        // Eski rasmni o'chirish
        if (findTutor.image && !findTutor.image.includes("default-icon")) {
          const oldImagePath = path.join(
            __dirname,
            "../public/images",
            findTutor.image.split("/public/images/")[1]
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      }

      const updatedTutor = await tutorModel.findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { new: true }
      );

      res.status(200).json({
        status: "success",
        message: "Tutor profili yangilandi",
        tutor: updatedTutor,
      });
    } catch (error) {
      console.error("Tutor profile update error:", error);
      res.status(500).json({
        status: "error",
        message: "Tutor profilini yangilashda xatolik",
      });
    }
  }
);

// Student qidirish (ID bo'yicha)
router.get("/student/find/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const findStudent = await StudentModel.find({
      student_id_number: id,
    }).select(
      "full_name first_name second_name student_id_number group level image"
    );

    if (!findStudent.length) {
      return res.status(404).json({
        status: "error",
        message: "Bunday student topilmadi",
        data: [],
      });
    }

    res.status(200).json({
      status: "success",
      data: findStudent,
    });
  } catch (error) {
    console.error("Student search error:", error);
    res.status(500).json({
      status: "error",
      message: "Student qidirishda xatolik",
      error: error.message,
    });
  }
});

// Student ma'lumotlarini yangilash
router.put(
  "/student/profile",
  authMiddleware,
  uploadSingleImage,
  async (req, res) => {
    try {
      const { userId } = req.userData;
      const findStudent = await StudentModel.findById(userId);

      if (!findStudent) {
        return res.status(404).json({
          status: "error",
          message: "Bunday student topilmadi",
        });
      }

      const updateFields = {};
      const { roommate_count, other } = req.body;

      if (roommate_count !== undefined)
        updateFields.roommate_count = roommate_count;
      if (other !== undefined) updateFields.other = other;
      updateFields.updated_at = Date.now();

      // Fayl yuklash
      if (req.file) {
        updateFields.image = `/public/images/${req.file.filename}`;

        // Eski rasmni o'chirish
        if (findStudent.image && !findStudent.image.includes("default-icon")) {
          const oldImagePath = path.join(
            __dirname,
            "../public/images",
            findStudent.image.split("/public/images/")[1]
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      }

      const updatedStudent = await StudentModel.findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { new: true, runValidators: false }
      );

      res.status(200).json({
        status: "success",
        message: "Student profili yangilandi",
        student: updatedStudent,
      });
    } catch (error) {
      console.error("Student profile update error:", error);
      res.status(500).json({
        status: "error",
        message: "Student profilini yangilashda xatolik",
      });
    }
  }
);

// Student statistikasi (admin uchun)
router.get("/students/stats", authMiddleware, async (req, res) => {
  try {
    const totalStudents = await StudentModel.countDocuments();
    const studentsWithApartments = await AppartmentModel.distinct("studentId")
      .length;

    const genderStats = await StudentModel.aggregate([
      {
        $group: {
          _id: "$gender.name",
          count: { $sum: 1 },
        },
      },
    ]);

    const levelStats = await StudentModel.aggregate([
      {
        $group: {
          _id: "$level.name",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        total: totalStudents,
        withApartments: studentsWithApartments,
        withoutApartments: totalStudents - studentsWithApartments,
        genderDistribution: genderStats,
        levelDistribution: levelStats,
      },
    });
  } catch (error) {
    console.error("Students stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Student statistikasini olishda xatolik",
    });
  }
});

export default router;
