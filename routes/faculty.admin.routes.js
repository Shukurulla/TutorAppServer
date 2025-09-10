// routes/faculty.admin.routes.js
import express from "express";
import facultyAdminModel from "../models/faculty.admin.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";
import StudentModel from "../models/student.model.js";
import bcrypt from "bcrypt";
import AppartmentModel from "../models/appartment.model.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.get("/faculties-with-assignment", async (req, res) => {
  try {
    // Studentlardan unique departmentlarni olish
    const departments = await StudentModel.aggregate([
      {
        $group: {
          _id: {
            name: "$department.name",
            code: "$department.code",
          },
        },
      },
      {
        $match: {
          "_id.name": { $ne: null, $exists: true },
        },
      },
      {
        $project: {
          name: "$_id.name",
          code: "$_id.code",
          _id: 0,
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    // Har bir fakultet uchun assignment statusini tekshirish
    const facultiesWithStatus = await Promise.all(
      departments.map(async (dept) => {
        const existingAdmin = await facultyAdminModel
          .findOne({
            "faculties.name": dept.name,
          })
          .select("firstName lastName");

        return {
          name: dept.name,
          code: dept.code || dept.name.toLowerCase().replace(/\s+/g, "_"),
          isAssigned: !!existingAdmin,
          assignedToAdmin: existingAdmin
            ? {
                id: existingAdmin._id,
                name: `${existingAdmin.firstName} ${existingAdmin.lastName}`,
              }
            : null,
        };
      })
    );

    res.json({
      status: "success",
      data: facultiesWithStatus,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Fakultetlar ro'yxatini olish (name va code bilan)
router.get("/faculties-with-codes", async (req, res) => {
  try {
    // Studentlardan unique departmentlarni olish
    const departments = await StudentModel.aggregate([
      {
        $group: {
          _id: {
            name: "$department.name",
            code: "$department.code",
          },
        },
      },
      {
        $match: {
          "_id.name": { $ne: null, $exists: true },
        },
      },
      {
        $project: {
          name: "$_id.name",
          code: "$_id.code",
          _id: 0,
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    // Har bir fakultet uchun allaqachon fakultet admin bor-yo'qligini tekshirish
    const facultiesWithAdmins = await Promise.all(
      departments.map(async (dept) => {
        const existingAdmin = await facultyAdminModel.findOne({
          "faculties.name": dept.name,
        });

        return {
          name: dept.name,
          code: dept.code || dept.name.toLowerCase().replace(/\s+/g, "_"),
          isAssigned: !!existingAdmin,
          assignedToAdmin: existingAdmin
            ? {
                id: existingAdmin._id,
                name: `${existingAdmin.firstName} ${existingAdmin.lastName}`,
              }
            : null,
        };
      })
    );

    res.json({
      status: "success",
      data: facultiesWithAdmins,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Fakultet admin uchun guruhlarni olish (tutor assignment status bilan)
router.get("/groups-with-tutors", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    // Fakultet admin profilini olish
    const facultyAdmin = await facultyAdminModel.findById(userId);
    if (!facultyAdmin) {
      return res.status(401).json({
        status: "error",
        message: "Bunday fakultet admin topilmadi",
      });
    }

    const facultyNames = facultyAdmin.faculties.map((f) => f.name);

    // Har bir fakultet uchun guruhlarni olish
    const allGroups = [];
    for (const facultyName of facultyNames) {
      const students = await StudentModel.find({
        "department.name": facultyName,
      }).select("group");

      // Unique guruhlarni olish
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
              educationLang: student.group.educationLang || {
                name: "O'zbek",
              },
              faculty: facultyName,
            });
          }
        }
      });

      allGroups.push(...uniqueGroups);
    }

    // Har bir guruh uchun tutor assignment statusini tekshirish
    const groupsWithTutors = await Promise.all(
      allGroups.map(async (group) => {
        const existingTutor = await tutorModel.findOne({
          "group.code": group.id.toString(),
        });

        return {
          ...group,
          isAssigned: !!existingTutor,
          assignedToTutor: existingTutor
            ? {
                id: existingTutor._id,
                name: existingTutor.name,
              }
            : null,
        };
      })
    );

    res.json({
      status: "success",
      data: groupsWithTutors,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post(
  "/tutor-create",
  authMiddleware,
  uploadSingleImage, // Multer middleware qo'shamiz
  async (req, res) => {
    try {
      const { userId } = req.userData;

      // Fakultet adminni tekshirish
      const findFacultyAdmin = await facultyAdminModel.findById(userId);
      if (!findFacultyAdmin) {
        return res.status(401).json({
          status: "error",
          message: "Siz fakultet admini emassiz",
        });
      }

      const { login, name, phone, password, group } = req.body;

      console.log("📥 Faculty Admin Tutor Create - Received data:", {
        login,
        name,
        phone,
        hasPassword: !!password,
        group,
        hasFile: !!req.file,
      });

      // Barcha majburiy maydonlarni tekshirish
      if (
        !login?.trim() ||
        !name?.trim() ||
        !phone?.trim() ||
        !password?.trim() ||
        !group
      ) {
        return res.status(400).json({
          status: "error",
          message: "Iltimos, barcha majburiy maydonlarni to'liq kiriting",
        });
      }

      // Group stringdan JSON ga parse qilish
      let parsedGroup;
      try {
        parsedGroup = typeof group === "string" ? JSON.parse(group) : group;
      } catch (error) {
        console.error("Group parse error:", error);
        return res.status(400).json({
          status: "error",
          message: "Guruh ma'lumotlarida xatolik",
        });
      }

      if (!Array.isArray(parsedGroup) || parsedGroup.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Iltimos, tutorga kamida bitta guruh biriktiring",
        });
      }

      // Login unique ekanligini tekshirish
      const existingTutor = await tutorModel.findOne({ login: login.trim() });
      if (existingTutor) {
        return res.status(400).json({
          status: "error",
          message: "Bu login allaqachon ishlatilgan",
        });
      }

      // Parolni hash qilish
      const hashedPassword = await bcrypt.hash(password, 10);

      // Rasm yo'li
      let imagePath =
        "https://static.vecteezy.com/system/resources/thumbnails/024/983/914/small/simple-user-default-icon-free-png.png";
      if (req.file) {
        imagePath = `/public/images/${req.file.filename}`;
      }

      // Tutorni yaratish
      const tutor = await tutorModel.create({
        login: login.trim(),
        name: name.trim(),
        phone: phone.trim(),
        password: hashedPassword,
        group: parsedGroup,
        facultyAdmin: userId, // MUHIM: Fakultet admin ID si
        image: imagePath,
      });

      console.log("✅ Tutor successfully created by faculty admin:", {
        tutorId: tutor._id,
        facultyAdminId: userId,
        groupsCount: parsedGroup.length,
      });

      res.status(200).json({
        status: "success",
        message: "Tutor muvaffaqiyatli yaratildi",
        data: tutor,
      });
    } catch (error) {
      console.error("❌ Faculty admin tutor create error:", error);
      res.status(500).json({
        status: "error",
        message: "Serverda xatolik yuz berdi: " + error.message,
      });
    }
  }
);

// Fakultet admin yaratish (faqat main admin)
router.post("/create", authMiddleware, async (req, res) => {
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
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const facultyAdmins = await facultyAdminModel.find();
    res.status(200).json({ status: "success", data: facultyAdmins });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Fakultet admin profili (fakultet admin uchun)
router.get("/profile", authMiddleware, async (req, res) => {
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
router.post("/tutor-create", authMiddleware, async (req, res) => {
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
router.get("/my-tutors", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const findFacultyAdmin = await facultyAdminModel.findById(userId);
    if (!findFacultyAdmin) {
      return res.status(401).json({
        status: "error",
        message: "Bunday fakultet admin topilmadi",
      });
    }

    // Faqat shu fakultet adminga tegishli tutorlarni olish
    const findTutors = await tutorModel.find({
      facultyAdmin: userId,
    });

    res.status(200).json({
      status: "success",
      data: findTutors,
    });
  } catch (error) {
    console.error("❌ Get faculty admin tutors error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
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
