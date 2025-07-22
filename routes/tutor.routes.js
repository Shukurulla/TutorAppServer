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

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post("/tutor/create", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { login, password, group, name, phone } = req.body;

    const findAdmin = await adminModel.findById(userId);
    if (!findAdmin) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday admin topilmadi" });
    }

    if (!login || !password || !group || !Array.isArray(JSON.parse(group))) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos, barcha ma'lumotlarni to'g'ri kiriting",
      });
    }

    const findTutor = await tutorModel.findOne({ login });
    if (findTutor) {
      return res.status(400).json({
        status: "error",
        message: "Bu tutor oldin ro'yxatdan o'tgan",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let imagePath = null;

    // Fayl yuklanganligini tekshirish
    if (req.files && req.files.image) {
      const imageFile = req.files.image;

      // Faylni saqlash uchun katalog
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const uploadDir = path.join(__dirname, "../public/images");

      // Agar katalog mavjud bo'lmasa, uni yaratish
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Faylni saqlash
      const fileName = `${Date.now()}_${imageFile.name}`;
      imagePath = `/public/images/${fileName}`;
      const savePath = path.join(uploadDir, fileName);

      await imageFile.mv(savePath);
    }

    const tutor = await tutorModel.create({
      login,
      group: JSON.parse(group),
      name,
      phone,
      password: hashedPassword,
      image: imagePath, // Rasmingizning yo'li bazaga saqlanadi
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
    console.log(req.body);
    
    if (!login || !password) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos, ma'lumotlarni to'liq kiriting",
      });
    }

    const findTutor = await tutorModel.findOne({ login });
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    // Tutor guruhlarini arrayga olish
    const groupNames = findTutor.group.map((g) => g.name);

    // Faqat kerakli guruhlarga tegishli studentlarni olish
    const students = await StudentModel.aggregate([
      { $match: { "group.name": { $in: groupNames } } },
      {
        $group: {
          _id: "$group.name",
          faculty: { $first: "$specialty.name" },
          studentCount: { $sum: 1 },
        },
      },
    ]);

    // Guruhlar bo‘yicha array yaratish
    const findStudents = findTutor.group.map((item) => {
      const groupInfo = students.find((s) => s._id === item.name);
      return {
        name: item.name,
        faculty: groupInfo ? groupInfo.faculty : "Noma'lum",
        studentCount: groupInfo ? groupInfo.studentCount : 0,
      };
    });

    // Parolni tekshirish
    const compare = await bcrypt.compare(password, findTutor.password);
    if (!compare) {
      return res
        .status(400)
        .json({ status: "error", message: "Parol mos kelmadi" });
    }

    // Token yaratish va ma'lumotlarni jo‘natish
    const token = generateToken(findTutor._id);
    const { _id, name, role, createdAt, updatedAt, phone, image } = findTutor;
    const data = {
      _id,
      login: findTutor.login,
      name,
      role,
      createdAt,
      phone,
      image,
      updatedAt,
      group: findStudents,
    };

    res.status(200).json({
      status: "success",
      data,
      token,
    });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});
router.get("/tutor/my-students", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    // Tutorni topish
    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    // Tutor guruhlarini olish
    const groupNames = findTutor.group.map((g) => g.name);

    // Faqat kerakli guruhlarga tegishli studentlarni olish
    const findStudents = await StudentModel.find({
      "group.name": { $in: groupNames },
    }).select(
      "group.name student_id_number accommodation faculty.name first_name second_name third_name full_name short_name university image address role"
    );

    // Guruhlar bo‘yicha studentlarni ajratish
    const groupStudents = groupNames.map((groupName) => ({
      group: groupName,
      students: findStudents.filter((s) => s.group.name === groupName),
    }));

    res.status(200).json({ status: "success", data: groupStudents });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/tutor/add-group/:tutorId", async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { groups } = req.body; // massiv: [{ name: "guruh nomi" }, {...}, ...]

    const findTutor = await tutorModel.findById(tutorId);
    if (!findTutor) {
      return res
        .status(404)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    if (!Array.isArray(groups)) {
      return res
        .status(400)
        .json({ status: "error", message: "Groups massivda bo'lishi kerak" });
    }

    // Grouplar massiviga yangi grouplarni qo'shish
    const updatedTutor = await tutorModel.findByIdAndUpdate(
      tutorId,
      { $push: { group: { $each: groups } } },
      { new: true }
    );

    res.status(200).json({
      status: "success",
      message: "Guruhlar qo‘shildi",
      tutor: updatedTutor,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Server xatosi" });
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

    res.status(201).json({
      status: "success",
      data: changeTutorData,
      message: "Password muaffaqiyatli ozgartirildi!",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/tutor/groups", authMiddleware, async (req, res) => {
  try {
    const findGroups = await StudentModel.find().select("group");
    const uniqueGroups = Array.from(
      new Map(
        findGroups.map((item) => [item.group.name, item.group]) // `group.name` ni key sifatida ishlatamiz
      ).values()
    );

    res.json({ status: "success", data: uniqueGroups });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/tutor/students-group/:group", authMiddleware, async (req, res) => {
  try {
    const { group } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, parseInt(limit, 10) || 20);

    const totalCount = await StudentModel.countDocuments({
      "group.name": group,
    });
    const totalPages = Math.ceil(totalCount / limitNumber);

    // 🛠 **Appartment-larni status + location bilan olish**
    const findAppartments = await AppartmentModel.find().select(
      "status studentId location"
    );

    const findStudents = await StudentModel.find({ "group.name": group })
      .select(
        "group.name province gender faculty.name first_name second_name third_name full_name short_name university image address role"
      )
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    const studentsWithStatus = findStudents.map((student) => {
      const studentAppartment = findAppartments.find(
        (appartment) =>
          appartment.studentId.toString() === student._id.toString()
      );

      return {
        ...student.toObject(),
        status: studentAppartment
          ? studentAppartment.status === "Being checked"
            ? "blue"
            : studentAppartment.status
          : "blue",
        location: studentAppartment?.location || null, // ✅ Endi location to'g'ri ishlaydi
        hasFormFilled: studentAppartment ? "true" : "false",
      };
    });

    res.json({
      status: "success",
      page: pageNumber,
      limit: limitNumber,
      totalStudents: totalCount,
      totalPages: totalPages,
      hasNextPage: pageNumber < totalPages,
      hasPrevPage: pageNumber > 1,
      nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
      prevPage: pageNumber > 1 ? pageNumber - 1 : null,
      data: studentsWithStatus,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/tutor/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findTutor = await tutorModel.findById(userId).populate("group"); // group ni populate qilish

    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    // Faqat kerakli studentlarni olish
    const groupNames = findTutor.group.map((g) => g.name);
    const students = await StudentModel.find({
      "group.name": { $in: groupNames },
    }).select("group department");

    // Fakultetlarni tutor group bilan bog‘lash
    const tutorFaculty = findTutor.group.map((item) => {
      const student = students.find((c) => c.group.name === item.name);
      console.log(student);

      return {
        name: item.name,
        faculty: student ? student.department.name : "Noma'lum fakultet",
      };
    });

    const {
      _id,
      login,
      name,
      password,
      image,
      phone,
      role,
      createdAt,
      updatedAt,
    } = findTutor;

    res.json({
      status: "success",
      data: {
        _id,
        login,
        name,
        password,
        role,
        image,
        phone,
        createdAt,
        updatedAt,
        group: tutorFaculty,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/tutor/notification", authMiddleware, async (req, res) => {
  try {
    const { userId, message } = req.body;
    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }
    const notification = await NotificationModel.create({ userId, message });
    res.json({ status: "success", data: notification });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/tutor/notification/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const findTutor = await tutorModel.findById(id);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }
    const notification = await NotificationModel.find({ userId: id });
    res.json({ status: "success", data: notification });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.put("/tutor/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const updateFields = {};
    const { login, name, phone, group } = req.body;
    if (login) updateFields.login = login;
    if (name) updateFields.name = name;
    if (phone) updateFields.phone = phone;
    if (group) updateFields.group = JSON.parse(group);

    // Fayl yuklangan bo'lsa, uni saqlaymiz
    if (req.files && req.files.image) {
      const imageFile = req.files.image;
      const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!allowedTypes.includes(imageFile.mimetype)) {
        return res
          .status(400)
          .json({ message: "Faqat rasm fayllari qabul qilinadi" });
      }

      const fileExt = path.extname(imageFile.name);
      const now = Date.now();
      const fileName = `${now}${userId}${fileExt}`;
      const uploadPath = path.join(__dirname, "../public/images", fileName);
      await imageFile.mv(uploadPath);
      updateFields.image = `http://45.134.39.117:5050/public/images/${fileName}`;
    }

    // Faqat kerakli joyni o'zgartirish uchun $set ishlatamiz
    const updatedTutor = await tutorModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    );

    res.status(200).json({ message: "Tutor yangilandi", tutor: updatedTutor });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post(
  "/tutor/delete-group/:tutorId",
  authMiddleware,
  async (req, res) => {
    try {
      const findTutor = await tutorModel.findById(req.params.tutorId);
      if (!findTutor) {
        return res
          .status(401)
          .json({ status: "error", message: "Bunday tutor topilmadi" });
      }
      const { groupName } = req.body;
      const { group } = findTutor;

      const findGroup = group.find((c) => c.name == groupName);
      if (!findGroup) {
        return res.status(401).json({
          status: "error",
          message: `Bu tutorda "${group} nomli guruh mavjud emas"`,
        });
      }
      const deletedGroup = group.filter((c) => c.name !== groupName);

      const editedTutor = await tutorModel.findByIdAndUpdate(
        findTutor._id,
        {
          $set: {
            group: deletedGroup,
          },
        },
        { new: true }
      );
      if (!editedTutor) {
        return res.status(500).json({
          status: "error",
          message: "Tutor malumotlarini ozgartirishda xatolik ketdi",
          data: editedTutor,
        });
      }
      res.status(200).json({
        status: "success",
        message: "Tutor malumotlari muaffaqiyatli ozgartirildi",
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.delete("/tutor/delete/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const findTutor = await tutorModel.findById(id);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday turor topilmadi" });
    }
    await tutorModel.findByIdAndDelete(id);
    res
      .status(200)
      .json({ status: "success", message: "tutorMuaffaqiyatli ochirildi" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
