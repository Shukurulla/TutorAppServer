import express from "express";
import adminModel from "../models/admin.model.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/token.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";
import StudentModel from "../models/student.model.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import adsModel from "../models/ads.model.js";
import { uploadAdsImages } from "../middlewares/upload.middleware.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post("/admin/ads", authMiddleware, uploadAdsImages, async (req, res) => {
  try {
    console.log("=== ADS CREATE BOSHLANDI ===");
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    // Title tekshirish
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Title majburiy",
      });
    }

    // Fayllar tekshirish
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        status: "error",
        message: "Image fayl majburiy",
      });
    }

    const imageFile = req.files.image[0];
    const iconFile = req.files.icon ? req.files.icon[0] : null;

    console.log("Image file:", imageFile ? imageFile.filename : "yo'q");
    console.log("Icon file:", iconFile ? iconFile.filename : "yo'q");

    // Ma'lumotlar bazasiga saqlash
    const newAd = new adsModel({
      title,
      image: `/public/ads/${imageFile.filename}`,
      icon: iconFile ? `/public/ads/${iconFile.filename}` : "",
    });

    await newAd.save();

    console.log("Ads bazaga saqlandi:", newAd._id);

    res.status(201).json({
      status: "success",
      message: "Reklama muvaffaqiyatli yaratildi",
      data: newAd,
    });
  } catch (error) {
    console.error("Ads yaratishda xatolik:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Test route
router.post("/admin/ads/test", authMiddleware, async (req, res) => {
  try {
    console.log("=== TEST ROUTE ===");
    console.log("Body:", req.body);
    console.log("Files:", req.files);
    console.log("Headers:", req.headers);

    res.json({
      status: "success",
      message: "Test route ishlayapti",
      body: req.body,
      files: req.files ? Object.keys(req.files) : "files yo'q",
      contentType: req.get("Content-Type"),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/admin/sign", async (req, res) => {
  try {
    const { username, password } = req.body;
    const findAdmin = await adminModel.findOne({ username });
    if (findAdmin) {
      return res.status(401).json({
        status: "error",
        message: "Bunday username oldin ishlatilgan",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await adminModel.create({
      username,
      password: hashedPassword,
    });

    const token = generateToken(admin._id);

    res.status(200).json({ status: "success", data: admin, token });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const findAdmin = await adminModel.findOne({ username });
    if (!findAdmin) {
      return res.json({
        status: "error",
        message: `${username} nomli admin topilmadi`,
      });
    }
    const compare = await bcrypt.compare(password, findAdmin.password);
    if (!compare) {
      return res
        .status(400)
        .json({ status: "error", message: "Password mos kelmadi" });
    }
    const token = generateToken(findAdmin._id);
    res.status(200).json({ status: "success", data: findAdmin, token });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.get("/admin/tutors", authMiddleware, async (req, res) => {
  try {
    const tutors = await tutorModel.find();

    const formattedTutors = tutors.map((tutor) => {
      return {
        _id: tutor._id,
        login: tutor.login,
        name: tutor.name,
        password: tutor.password,
        role: tutor.role,
        createdAt: tutor.createdAt,
        phone: tutor.phone,
        image: tutor.image,
        updatedAt: tutor.updatedAt,
        group: tutor.group,
      };
    });

    res.status(200).json({ status: "success", data: formattedTutors });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;