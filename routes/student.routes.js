import express from "express";
import StudentModel from "../models/student.model.js";
import axios from "axios";
import generateToken from "../utils/token.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import AppartmentModel from "../models/appartment.model.js";

import fileUpload from "express-fileupload";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
router.use(fileUpload());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post("/student/sign", async (req, res) => {
  try {
    const { login, password } = req.body;
    const findStudent = await StudentModel.findOne({
      student_id_number: login.toString(),
    });

    if (findStudent) {
      const token = generateToken(findStudent._id);
      return res.json({ status: "success", student: findStudent, token });
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

    res.json({ status: "success", student, token });
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

router.put("/student/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findStudent = await StudentModel.findById(userId);
    if (!findStudent) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday student topilmadi" });
    }

    const { gender } = req.body; // Genderni olib ko'ramiz
    let imagePath = findStudent.image; // Oldingi rasmni saqlab qolish

    // Agar foydalanuvchi yangi rasm yuborgan bo'lsa
    if (req.files && req.files.image) {
      const imageFile = req.files.image;
      const fileExt = path.extname(imageFile.name);
      const fileName = `${userId}${fileExt}`;
      const uploadPath = path.join(
        __dirname,
        "../public/studentImages",
        fileName
      );

      await imageFile.mv(uploadPath);
      imagePath = `http://45.134.39.117:5050/public/studentImages/${fileName}`;
    }

    // Ma'lumotlarni yangilash
    const student = await StudentModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          gender, // Gender yangilanadi
          image: imagePath,
        },
      },
      { new: true }
    );

    res.status(200).json({ status: "success", data: student });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
