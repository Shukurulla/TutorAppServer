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
  try {
    function formatDate(timestamp) {
      const date = new Date(timestamp * 1000);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();

      return `${day}.${month}.${year}`;
    }

    const { login, password } = req.body;
    const findStudent = await StudentModel.findOne({
      student_id_number: login.toString(),
    }).lean();

    if (findStudent) {
      const token = generateToken(findStudent._id);
      return res.json({
        status: "success",
        student: {
          ...findStudent,
          birth_date: formatDate(findStudent.birth_date),
        },
        token,
      });
    }

    const { data } = await axios.post(
      `${process.env.HEMIS_API_URL}/auth/login`,
      { login, password }
    );

    if (!data.data.token) {
      return res.json({ status: "error", message: "Token olinmadi" });
    }

    const account = await axios.get(`${process.env.HEMIS_API_URL}/account/me`, {
      headers: {
        Authorization: `Bearer ${data.data.token}`,
      },
    });

    const student = await StudentModel.create(account.data.data);
    const token = generateToken(student._id);

    res.json({ status: "success", student: student.toObject(), token });
  } catch (error) {
    res.json({ message: error.message });
  }
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
