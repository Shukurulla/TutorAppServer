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

import fileUpload from "express-fileupload";
import { fileURLToPath } from "url";
import NotificationModel from "../models/notification.model.js";

const router = express.Router();

router.use(fileUpload());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post("/tutor/create", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { login, password, group, name } = req.body;

    const findAdmin = await adminModel.findById(userId);
    if (!findAdmin) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday admin topilmadi" });
    }

    if (!login || !password || !group || !Array.isArray(group)) {
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

    const tutor = await tutorModel.create({
      login,
      group, // <-- Endi bu array sifatida keladi va saqlanadi
      name,
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

    const students = await StudentModel.find();

    const findStudents = findTutor.group.map((item) => {
      return {
        name: item.name,
        faculty: students.filter((c) => c.group.name == item.name)[0].faculty
          .name,
        studentCount: students.filter((c) => c.group.name == item.name).length,
      };
    });

    const compare = await bcrypt.compare(password, findTutor.password);
    if (!compare) {
      return res
        .status(400)
        .json({ status: "error", message: "Password mos kelmadi" });
    }

    const token = generateToken(findTutor._id);
    const { _id, name, role, createdAt, updatedAt } = findTutor;
    const data = {
      _id,
      login: findTutor.login,
      name,
      password: findTutor.password,
      role,
      createdAt,
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

    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const group = findTutor.group;
    const findStudents = await StudentModel.find().select(
      "group.name faculty.name first_name second_name third_name full_name short_name university image  address  role"
    );
    const groupStudents = group.map((item) => {
      return {
        group: item.name,
        students: findStudents.filter((c) => c.group.name == item.name),
      };
    });

    res.status(201).json({ status: "success", data: groupStudents });
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
    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const students = await StudentModel.find();

    const tutorFaculty = findTutor.group.map((item) => {
      return {
        name: item.name,
        faculty: students.find((c) => c.group.name == item.name).faculty.name,
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

    const tutorSchema = {
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
    };

    res.json({
      status: "success",
      data: tutorSchema,
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

// router.put("/tutor/profile", authMiddleware, async (req, res) => {
//   try {
//     const { userId } = req.userData;
//     const findTutor = await tutorModel.findById(userId);
//     if (!findTutor) {
//       return res
//         .status(400)
//         .json({ status: "error", message: "Bunday tutor topilmadi" });
//     }

//     const updateFields = {};
//     const { login, name, phone, group } = req.body;
//     if (login) updateFields.login = login;
//     if (name) updateFields.name = name;
//     if (phone) updateFields.phone = phone;
//     if (group) updateFields.group = JSON.parse(group);

//     // Fayl yuklangan bo'lsa, uni saqlaymiz
//     if (req.files && req.files.image) {
//       const imageFile = req.files.image;
//       const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
//       if (!allowedTypes.includes(imageFile.mimetype)) {
//         return res
//           .status(400)
//           .json({ message: "Faqat rasm fayllari qabul qilinadi" });
//       }

//       const fileExt = path.extname(imageFile.name);
//       const fileName = `${userId}${fileExt}`;
//       const uploadPath = path.join(__dirname, "../public/images", fileName);
//       await imageFile.mv(uploadPath);
//       updateFields.image = `http://45.134.39.117:5050/public/images/${fileName}`;
//     }

//     // Faqat kerakli joyni o'zgartirish uchun $set ishlatamiz
//     const updatedTutor = await tutorModel.findByIdAndUpdate(
//       userId,
//       { $set: updateFields },
//       { new: true }
//     );

//     res.status(200).json({ message: "Tutor yangilandi", tutor: updatedTutor });
//   } catch (error) {
//     res.status(500).json({ status: "error", message: error.message });
//   }
// });

export default router;
