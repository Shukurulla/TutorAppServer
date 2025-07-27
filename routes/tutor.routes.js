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

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tutor uchun barcha studentlarga report notification jo'natish
router.post("/tutor/send-report-all", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { message } = req.body;

    // Tutorni topish
    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res.status(400).json({
        status: "error",
        message: "Bunday tutor topilmadi",
      });
    }

    // Tutor guruhlarini olish
    const groupNames = findTutor.group.map((g) => g.name);

    // Guruhlarga tegishli studentlarni topish
    const students = await StudentModel.find({
      "group.name": { $in: groupNames },
    });

    if (!students.length) {
      return res.status(400).json({
        status: "error",
        message: "Bu guruhlarda studentlar topilmadi",
      });
    }

    const notifications = [];
    const updateOperations = [];

    // Har bir student uchun
    for (const student of students) {
      // Studentning barcha appartmentlarini topish
      const appartments = await AppartmentModel.find({
        studentId: student._id,
      });

      if (appartments.length > 0) {
        // Barcha appartmentlarni eski qilish (needNew: true, current: false)
        updateOperations.push(
          AppartmentModel.updateMany(
            { studentId: student._id },
            {
              $set: {
                needNew: true,
                current: false,
              },
            }
          )
        );

        // Eng oxirgi appartmentni topish (notification uchun)
        const latestAppartment = appartments.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )[0];

        // Notification yaratish
        notifications.push({
          userId: student._id,
          message: message || "Ijara ma'lumotlarini qayta to'ldiring",
          appartmentId: latestAppartment._id,
          status: "red",
          need_data: "Ijara ma'lumotlarini qayta kiritish talab qilinadi",
          notification_type: "report",
          isRead: false,
        });
      }
    }

    // Barcha update operatsiyalarini bajarish
    await Promise.all(updateOperations);

    // Notificationlarni yaratish
    if (notifications.length > 0) {
      await NotificationModel.insertMany(notifications);
    }

    res.status(200).json({
      status: "success",
      message: `${notifications.length} ta studentga notification jo'natildi`,
      data: {
        studentsCount: students.length,
        notificationsCount: notifications.length,
      },
    });
  } catch (error) {
    console.error("Notification jo'natishda xatolik:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post(
  "/tutor/create",
  authMiddleware,
  uploadSingleImage,
  async (req, res) => {
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
      if (req.file) {
        imagePath = `/public/images/${req.file.filename}`;
      }

      const tutor = await tutorModel.create({
        login,
        group: JSON.parse(group),
        name,
        phone,
        password: hashedPassword,
        image: imagePath,
      });

      res.status(200).json({ status: "success", data: tutor });
    } catch (error) {
      res
        .status(error.status || 500)
        .json({ status: "error", message: error.message });
    }
  }
);

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

    // Guruhlar bo'yicha array yaratish
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

    // Token yaratish va ma'lumotlarni jo'natish
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

    // Guruhlar bo'yicha studentlarni ajratish
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
      message: "Guruhlar qo'shildi",
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
      new Map(findGroups.map((item) => [item.group.name, item.group])).values()
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
        location: studentAppartment?.location || null,
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

    const groupNames = findTutor.group.map((g) => g.name);
    const students = await StudentModel.find({
      "group.name": { $in: groupNames },
    }).select("group department");

    const tutorFaculty = findTutor.group.map((item) => {
      const student = students.find((c) => c.group.name === item.name);
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

router.put(
  "/tutor/profile",
  authMiddleware,
  uploadSingleImage,
  async (req, res) => {
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
      if (req.file) {
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
        updateFields.image = `/public/images/${req.file.filename}`;
      }

      const updatedTutor = await tutorModel.findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { new: true }
      );

      res.status(200).json({
        status: "success",
        message: "Tutor yangilandi",
        tutor: updatedTutor,
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

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
