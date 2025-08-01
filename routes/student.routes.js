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

router.post("/student/sign", async (req, res) => {
  const { login, password } = req.body;

  let tokenData;
  try {
    // 1. HEMIS'ga login
    const { data } = await axios.post(
      `${process.env.HEMIS_API_URL}/auth/login`,
      { login, password }
    );
    tokenData = data;
  } catch (err) {
    // ❗ Agar HEMIS 401 bersa, lokal bazani tekshiramiz
    const findMockStudent = await StudentModel.findOne({
      student_id_number: login,
    }).lean();

    if (!findMockStudent) {
      return res.status(401).json({
        status: "error",
        message:
          "Login ma'lumotlari noto‘g‘ri, va bunday student bazada topilmadi",
      });
    }

    const token = generateToken(findMockStudent._id);
    return res.status(200).json({
      status: "success",
      student: findMockStudent,
      token,
    });
  }

  // 2. Agar login muvaffaqiyatli bo‘lsa, token bo‘yicha account olish
  let account;
  try {
    const response = await axios.get(
      `${process.env.HEMIS_API_URL}/account/me`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.data.token}`,
        },
      }
    );
    account = response.data;
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Tizimdan ma'lumot olishda xatolik",
    });
  }

  // 3. Studentni bazada izlash
  const findStudent = await StudentModel.findOne({
    student_id_number: account.data?.student_id_number,
  }).lean();

  if (!findStudent) {
    // 4. Agar yo‘q bo‘lsa, yangi student yaratamiz
    const student = await StudentModel.create(account.data);
    const token = generateToken(student._id);
    return res.status(200).json({
      status: "success",
      student,
      token,
    });
  }

  // 5. Agar topilsa, yangilaymiz
  const updateStudent = await StudentModel.findByIdAndUpdate(
    findStudent._id,
    { $set: { ...account.data } },
    { new: true }
  );

  const token = generateToken(updateStudent._id);

  const findAppartment = await AppartmentModel.findOne({
    studentId: updateStudent._id,
  });

  return res.status(200).json({
    status: "success",
    student: {
      ...updateStudent,
      findAppartment: findAppartment ? true : false,
    },
    token,
  });
});

router.post("/student/create-byside", async (req, res) => {
  try {
    const student = await StudentModel.create(req.body);
    res.json(student);
  } catch (error) {
    res.json({ message: error.message });
  }
});

router.get("/student/notification/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const findStudent = await StudentModel.findById(id);
    if (!findStudent) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday student topilmadi" });
    }

    const appartments = await AppartmentModel.find({
      studentId: id,
      view: false,
    });
    res.status(200).json({
      status: "success",
      data: appartments
        .filter((c) => c.status != "Being checked")
        .map((item) => {
          return {
            status: item.status,
          };
        }),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/student/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findStudent = await StudentModel.findById(userId);
    if (!findStudent) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday student topilmadi" });
    }

    const schema = {
      gender: findStudent.gender,
      province: findStudent.province.name,
      image: findStudent.image || null,
    };

    res.status(200).json({ status: "success", data: schema });
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

      // Handle file upload with Multer
      if (req.file) {
        updateFields.image = `/public/images/${req.file.filename}`;

        // Delete the old image if it exists
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

      // Update the tutor's profile
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
      console.error("Error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get("/student/find/:id", async (req, res) => {
  try {
    const findStudent = await StudentModel.find({
      student_id_number: req.params.id,
    });
    res.json({ data: findStudent });
  } catch (error) {
    res.json({ error: error.message });
  }
});

export default router;
