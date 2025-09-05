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
const cleanStudentData = (studentData) => {
  try {
    console.log(
      "🧹 Cleaning student data for:",
      studentData?.student_id_number
    );

    if (!studentData) {
      throw new Error("Student data is null or undefined");
    }

    // Ma'lumotlarni tozalash va to'g'ri format berish
    const cleanedData = {
      // Asosiy ma'lumotlar
      id: studentData.id
        ? isNaN(studentData.id)
          ? studentData.id
          : parseInt(studentData.id)
        : null,
      university: studentData.university || {},
      full_name: studentData.full_name || "",
      short_name: studentData.short_name || "",
      first_name: studentData.first_name || "",
      second_name: studentData.second_name || "",
      third_name: studentData.third_name || "",

      // Gender ma'lumotlari
      gender: studentData.gender
        ? {
            code: studentData.gender.code || "",
            name: studentData.gender.name || "",
          }
        : { code: "", name: "" },

      // Sana va raqamli ma'lumotlar
      birth_date: studentData.birth_date
        ? typeof studentData.birth_date === "number"
          ? studentData.birth_date
          : parseInt(studentData.birth_date) || null
        : null,
      student_id_number: studentData.student_id_number || "",
      image: studentData.image || "",
      avg_gpa: studentData.avg_gpa
        ? parseFloat(studentData.avg_gpa) || null
        : null,
      avg_grade: studentData.avg_grade
        ? parseFloat(studentData.avg_grade) || null
        : null,
      total_credit: studentData.total_credit
        ? parseInt(studentData.total_credit) || null
        : null,

      // Joylashuv ma'lumotlari
      country: studentData.country
        ? {
            code: studentData.country.code || "",
            name: studentData.country.name || "",
          }
        : { code: "", name: "" },

      province: studentData.province
        ? {
            code: studentData.province.code || "",
            name: studentData.province.name || "",
            _parent: studentData.province._parent || "",
          }
        : { code: "", name: "", _parent: "" },

      currentProvince: studentData.currentProvince
        ? {
            code: studentData.currentProvince.code || "",
            name: studentData.currentProvince.name || "",
            _parent: studentData.currentProvince._parent || "",
          }
        : { code: "", name: "", _parent: "" },

      district: studentData.district
        ? {
            code: studentData.district.code || "",
            name: studentData.district.name || "",
            _parent: studentData.district._parent || "",
          }
        : { code: "", name: "", _parent: "" },

      currentDistrict: studentData.currentDistrict
        ? {
            code: studentData.currentDistrict.code || "",
            name: studentData.currentDistrict.name || "",
            _parent: studentData.currentDistrict._parent || "",
          }
        : { code: "", name: "", _parent: "" },

      terrain: studentData.terrain
        ? {
            code: studentData.terrain.code || "",
            name: studentData.terrain.name || "",
          }
        : { code: "", name: "" },

      currentTerrain: studentData.currentTerrain
        ? {
            code: studentData.currentTerrain.code || "",
            name: studentData.currentTerrain.name || "",
          }
        : { code: "", name: "" },

      citizenship: studentData.citizenship
        ? {
            code: studentData.citizenship.code || "",
            name: studentData.citizenship.name || "",
          }
        : { code: "", name: "" },

      // Student status va kategoriyalar
      studentStatus: studentData.studentStatus
        ? {
            code: studentData.studentStatus.code || "",
            name: studentData.studentStatus.name || "",
          }
        : { code: "", name: "" },

      _curriculum: studentData._curriculum
        ? typeof studentData._curriculum === "number"
          ? studentData._curriculum
          : parseInt(studentData._curriculum) || null
        : null,

      educationForm: studentData.educationForm
        ? {
            code: studentData.educationForm.code || "",
            name: studentData.educationForm.name || "",
          }
        : { code: "", name: "" },

      educationType: studentData.educationType
        ? {
            code: studentData.educationType.code || "",
            name: studentData.educationType.name || "",
          }
        : { code: "", name: "" },

      paymentForm: studentData.paymentForm
        ? {
            code: studentData.paymentForm.code || "",
            name: studentData.paymentForm.name || "",
          }
        : { code: "", name: "" },

      studentType: studentData.studentType
        ? {
            code: studentData.studentType.code || "",
            name: studentData.studentType.name || "",
          }
        : { code: "", name: "" },

      socialCategory: studentData.socialCategory
        ? {
            code: studentData.socialCategory.code || "",
            name: studentData.socialCategory.name || "",
          }
        : { code: "", name: "" },

      accommodation: studentData.accommodation
        ? {
            code: studentData.accommodation.code || "",
            name: studentData.accommodation.name || "",
          }
        : { code: "", name: "" },

      // Department ma'lumotlari (Mixed type)
      department: studentData.department
        ? {
            id: studentData.department.id, // Mixed type - string yoki number bo'lishi mumkin
            name: studentData.department.name || "",
            code: studentData.department.code || "",
            structureType: studentData.department.structureType
              ? {
                  code: studentData.department.structureType.code || "",
                  name: studentData.department.structureType.name || "",
                }
              : { code: "", name: "" },
            localityType: studentData.department.localityType
              ? {
                  code: studentData.department.localityType.code || "",
                  name: studentData.department.localityType.name || "",
                }
              : { code: "", name: "" },
            parent: studentData.department.parent || null,
            active: Boolean(studentData.department.active),
          }
        : {
            id: null,
            name: "",
            code: "",
            structureType: { code: "", name: "" },
            localityType: { code: "", name: "" },
            parent: null,
            active: false,
          },

      // Specialty ma'lumotlari (Mixed type)
      specialty: studentData.specialty
        ? {
            id: studentData.specialty.id, // Mixed type - string yoki number bo'lishi mumkin
            code: studentData.specialty.code || "",
            name: studentData.specialty.name || "",
          }
        : {
            id: null,
            code: "",
            name: "",
          },

      // Group ma'lumotlari (Mixed type)
      group: studentData.group
        ? {
            id: studentData.group.id, // Mixed type - string yoki number bo'lishi mumkin
            name: studentData.group.name || "",
            educationLang: studentData.group.educationLang
              ? {
                  code: studentData.group.educationLang.code || "",
                  name: studentData.group.educationLang.name || "",
                }
              : { code: "", name: "" },
          }
        : {
            id: null,
            name: "",
            educationLang: { code: "", name: "" },
          },

      // Level ma'lumotlari
      level: studentData.level
        ? {
            code: studentData.level.code || "",
            name: studentData.level.name || "",
          }
        : { code: "", name: "" },

      // Semester ma'lumotlari (Mixed type)
      semester: studentData.semester
        ? {
            id: studentData.semester.id, // Mixed type - string yoki number bo'lishi mumkin
            code: studentData.semester.code || "",
            name: studentData.semester.name || "",
          }
        : {
            id: null,
            code: "",
            name: "",
          },

      // Education year
      educationYear: studentData.educationYear
        ? {
            code: studentData.educationYear.code || "",
            name: studentData.educationYear.name || "",
            current: Boolean(studentData.educationYear.current),
          }
        : { code: "", name: "", current: false },

      // Qolgan ma'lumotlar
      year_of_enter: studentData.year_of_enter
        ? typeof studentData.year_of_enter === "number"
          ? studentData.year_of_enter
          : parseInt(studentData.year_of_enter) || null
        : null,
      roommate_count: studentData.roommate_count || null,
      is_graduate: Boolean(studentData.is_graduate),
      total_acload: studentData.total_acload || null,
      other: studentData.other || "",

      // Vaqt belgilari
      created_at: studentData.created_at
        ? typeof studentData.created_at === "number"
          ? studentData.created_at
          : parseInt(studentData.created_at) || Date.now()
        : Date.now(),
      updated_at: studentData.updated_at
        ? typeof studentData.updated_at === "number"
          ? studentData.updated_at
          : parseInt(studentData.updated_at) || Date.now()
        : Date.now(),

      // Hash va validation
      hash: studentData.hash || "",
      validateUrl: studentData.validateUrl || "",
    };

    console.log("✅ Student data cleaned successfully");
    return cleanedData;
  } catch (error) {
    console.error("❌ Error cleaning student data:", error);
    throw new Error(`Student data cleaning failed: ${error.message}`);
  }
};

// Student login endpoint
router.post("/student/sign", async (req, res) => {
  const { login, password } = req.body;

  console.log("🔐 Student sign attempt:", { login });

  if (!login || !password) {
    return res.status(400).json({
      status: "error",
      message: "Login va parol kiritish majburiy",
    });
  }

  let tokenData;
  try {
    console.log("📡 Calling HEMIS API for authentication...");
    const { data } = await axios.post(
      `${process.env.HEMIS_API_URL}/auth/login`,
      { login, password },
      {
        timeout: 10000, // 10 sekund timeout
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    tokenData = data;
    console.log("✅ HEMIS authentication successful");
  } catch (err) {
    console.log("❌ HEMIS API failed:", err.message);
    console.log("🔍 Checking local database for student...");

    try {
      const findMockStudent = await StudentModel.findOne({
        student_id_number: login,
      }).lean();

      if (!findMockStudent) {
        return res.status(401).json({
          status: "error",
          message:
            "Login ma'lumotlari noto'g'ri, va bunday student bazada topilmadi",
        });
      }

      const token = generateToken(findMockStudent._id);
      const existAppartment = await AppartmentModel.findOne({
        studentId: findMockStudent._id,
      });

      console.log("✅ Local student found and authenticated");
      return res.status(200).json({
        status: "success",
        student: {
          ...findMockStudent,
          existAppartment: !!existAppartment,
        },
        token,
      });
    } catch (dbError) {
      console.error("❌ Database error:", dbError);
      return res.status(500).json({
        status: "error",
        message: "Bazada ma'lumotlarni tekshirishda xatolik",
      });
    }
  }

  let account;
  try {
    console.log("👤 Getting user account data from HEMIS...");
    const response = await axios.get(
      `${process.env.HEMIS_API_URL}/account/me`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.data.token}`,
        },
        timeout: 10000, // 10 sekund timeout
      }
    );
    account = response.data;
    console.log("✅ Account data received from HEMIS");
  } catch (err) {
    console.error("❌ Account data fetch failed:", err.message);
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
    // Student bazada mavjudligini tekshirish
    const findStudent = await StudentModel.findOne({
      student_id_number: account.data.student_id_number,
    }).lean();

    if (!findStudent) {
      console.log("🆕 Creating new student in database...");

      // Yangi student yaratish
      const cleanedStudentData = cleanStudentData(account.data);
      const student = await StudentModel.create(cleanedStudentData);

      const token = generateToken(student._id);
      const existAppartment = await AppartmentModel.findOne({
        studentId: student._id,
      });

      console.log(
        "✅ New student created successfully:",
        student.student_id_number
      );
      return res.status(200).json({
        status: "success",
        message: "Student muvaffaqiyatli ro'yxatdan o'tdi",
        student: {
          ...student.toObject(),
          existAppartment: !!existAppartment,
        },
        token,
      });
    }

    console.log("🔄 Updating existing student data...");

    // Mavjud studentni yangilash
    const cleanedUpdateData = cleanStudentData(account.data);
    const updateStudent = await StudentModel.findByIdAndUpdate(
      findStudent._id,
      { $set: cleanedUpdateData },
      {
        new: true,
        runValidators: false, // Validation ni o'chirish chunki Mixed type ishlatilmoqda
        lean: false,
      }
    );

    if (!updateStudent) {
      throw new Error("Student yangilanmadi");
    }

    const token = generateToken(updateStudent._id);
    const existAppartment = await AppartmentModel.findOne({
      studentId: updateStudent._id,
    });

    console.log(
      "✅ Student updated successfully:",
      updateStudent.student_id_number
    );
    return res.status(200).json({
      status: "success",
      message: "Student ma'lumotlari yangilandi",
      student: {
        ...updateStudent.toObject(),
        existAppartment: !!existAppartment,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Database operation failed:", error);

    // Xatolik turini aniqlash
    if (error.name === "ValidationError") {
      console.error("Validation errors details:", error.errors);
      return res.status(400).json({
        status: "error",
        message: "Ma'lumotlar formati noto'g'ri",
        details: Object.keys(error.errors).map((key) => ({
          field: key,
          message: error.errors[key].message,
          value: error.errors[key].value,
        })),
      });
    }

    if (error.name === "CastError") {
      console.error("Cast error details:", error);
      return res.status(400).json({
        status: "error",
        message: "Ma'lumot turi noto'g'ri",
        field: error.path,
        value: error.value,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Bazada ma'lumotlarni saqlashda xatolik",
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
      current: true,
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
