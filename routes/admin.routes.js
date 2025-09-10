// routes/admin.routes.js (yangilangan qism)
import express from "express";
import adminModel from "../models/admin.model.js";
import facultyAdminModel from "../models/faculty.admin.model.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/token.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";

const router = express.Router();

router.get("/admin/faculty-admins/search", authMiddleware, async (req, res) => {
  try {
    const { q } = req.query; // search query

    let query = {};
    if (q) {
      query = {
        $or: [
          { firstName: { $regex: q, $options: "i" } },
          { lastName: { $regex: q, $options: "i" } },
          { login: { $regex: q, $options: "i" } },
          { "faculties.name": { $regex: q, $options: "i" } },
        ],
      };
    }

    const facultyAdmins = await facultyAdminModel
      .find(query)
      .select("-password");

    const formattedFacultyAdmins = facultyAdmins.map((admin) => ({
      _id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      fullName: `${admin.firstName} ${admin.lastName}`,
      login: admin.login,
      faculties: admin.faculties,
      role: admin.role,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    }));

    res.status(200).json({ status: "success", data: formattedFacultyAdmins });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Faculty admin uchun tutorlarni search qilish
router.get("/faculty-admin/tutors/search", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { q } = req.query;

    const findFacultyAdmin = await facultyAdminModel.findById(userId);
    if (!findFacultyAdmin) {
      return res.status(401).json({
        status: "error",
        message: "Bunday fakultet admin topilmadi",
      });
    }

    let query = { facultyAdmin: userId };
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { login: { $regex: q, $options: "i" } },
        { "group.name": { $regex: q, $options: "i" } },
      ];
    }

    const findTutors = await tutorModel.find(query);
    res.status(200).json({ status: "success", data: findTutors });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Yangilangan login tizimi
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        status: "error",
        message: "Login va parol majburiy",
      });
    }

    // Avval main adminni tekshirish
    const findMainAdmin = await adminModel.findOne({ username });

    if (findMainAdmin) {
      const comparePassword = await bcrypt.compare(
        password,
        findMainAdmin.password
      );
      if (!comparePassword) {
        return res.status(400).json({
          status: "error",
          message: "Parol noto'g'ri",
        });
      }

      const token = generateToken(findMainAdmin._id);
      return res.status(200).json({
        status: "success",
        data: {
          ...findMainAdmin.toObject(),
          role: "mainAdmin",
        },
        token,
      });
    }

    // Agar main admin topilmasa, fakultet adminni tekshirish
    const findFacultyAdmin = await facultyAdminModel.findOne({
      login: username,
    });

    if (findFacultyAdmin) {
      // Faculty admin uchun parol hash qilinmagan
      if (password !== findFacultyAdmin.password) {
        return res.status(400).json({
          status: "error",
          message: "Parol noto'g'ri",
        });
      }

      const token = generateToken(findFacultyAdmin._id);
      return res.status(200).json({
        status: "success",
        data: {
          ...findFacultyAdmin.toObject(),
          role: "facultyAdmin",
        },
        token,
      });
    }

    // Hech kim topilmasa
    return res.status(401).json({
      status: "error",
      message: "Login yoki parol noto'g'ri",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Main admin uchun fakultet adminlarni olish
router.get("/admin/faculty-admins", authMiddleware, async (req, res) => {
  try {
    // Bu endpoint faqat main admin uchun
    const facultyAdmins = await facultyAdminModel.find().select("-password");

    const formattedFacultyAdmins = facultyAdmins.map((admin) => ({
      _id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      fullName: `${admin.firstName} ${admin.lastName}`,
      login: admin.login,
      faculties: admin.faculties,
      role: admin.role,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    }));

    res.status(200).json({ status: "success", data: formattedFacultyAdmins });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Fakultet admin yaratish (main admin uchun)
router.post("/admin/create-faculty-admin", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, login, password, faculties } = req.body;

    if (
      !firstName ||
      !lastName ||
      !login ||
      !password ||
      !Array.isArray(faculties)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos, barcha maydonlarni to'liq kiriting",
      });
    }

    // Login unique ekanligini tekshirish (ham admin, ham faculty admin)
    const [existingAdmin, existingFacultyAdmin] = await Promise.all([
      adminModel.findOne({ username: login }),
      facultyAdminModel.findOne({ login }),
    ]);

    if (existingAdmin || existingFacultyAdmin) {
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

// User info endpoint (role asosida)
router.get("/admin/me", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    // Avval main adminni tekshirish
    const mainAdmin = await adminModel.findById(userId);
    if (mainAdmin) {
      return res.status(200).json({
        status: "success",
        data: {
          ...mainAdmin.toObject(),
          role: "mainAdmin",
        },
      });
    }

    // Fakultet adminni tekshirish
    const facultyAdmin = await facultyAdminModel.findById(userId);
    if (facultyAdmin) {
      return res.status(200).json({
        status: "success",
        data: {
          ...facultyAdmin.toObject(),
          role: "facultyAdmin",
        },
      });
    }

    return res.status(404).json({
      status: "error",
      message: "Foydalanuvchi topilmadi",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.put("/admin/faculty-admin/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, login, password } = req.body;

    if (!firstName || !lastName || !login) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos, barcha majburiy maydonlarni to'liq kiriting",
      });
    }

    // Login unique ekanligini tekshirish (o'zi bundan tashqari)
    const existingFacultyAdmin = await facultyAdminModel.findOne({
      login,
      _id: { $ne: id },
    });

    if (existingFacultyAdmin) {
      return res.status(400).json({
        status: "error",
        message: "Bu login allaqachon ishlatilgan",
      });
    }

    const updateData = {
      firstName,
      lastName,
      login,
    };

    // Agar parol berilgan bo'lsa, uni ham yangilaymiz
    if (password) {
      updateData.password = password; // Hash qilinmaydi
    }

    const updatedFacultyAdmin = await facultyAdminModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedFacultyAdmin) {
      return res.status(404).json({
        status: "error",
        message: "Fakultet admin topilmadi",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Fakultet admin muvaffaqiyatli yangilandi",
      data: updatedFacultyAdmin,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Fakultetni fakultet admindan o'chirish
router.delete("/admin/remove-faculty", authMiddleware, async (req, res) => {
  try {
    const { facultyAdminId, facultyName } = req.body;

    if (!facultyAdminId || !facultyName) {
      return res.status(400).json({
        status: "error",
        message: "Fakultet admin ID va fakultet nomi majburiy",
      });
    }

    const facultyAdmin = await facultyAdminModel.findById(facultyAdminId);
    if (!facultyAdmin) {
      return res.status(404).json({
        status: "error",
        message: "Fakultet admin topilmadi",
      });
    }

    // Fakultetni ro'yxatdan o'chirish
    const updatedFaculties = facultyAdmin.faculties.filter(
      (faculty) => faculty.name !== facultyName
    );

    await facultyAdminModel.findByIdAndUpdate(
      facultyAdminId,
      { $set: { faculties: updatedFaculties } },
      { new: true }
    );

    res.status(200).json({
      status: "success",
      message: "Fakultet muvaffaqiyatli o'chirildi",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
