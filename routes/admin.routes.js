import express from "express";
import adminModel from "../models/admin.model.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/token.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";
import StudentModel from "../models/student.model.js";
import path from "path";
import fs from "fs";
import fileUpload from "express-fileupload";
import { fileURLToPath } from "url";
import adsModel from "../models/ads.model.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.use(fileUpload());

router.post("/admin/ads", authMiddleware, async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "Image fayl majburiy." });
    }

    const { title } = req.body;
    const imageFile = req.files.image;
    const iconFile = req.files.icon;

    const newAd = await adsModel.create({ title, image: "", icon: "" });

    const adsDir = path.join(__dirname, "../public/ads");
    if (!fs.existsSync(adsDir)) fs.mkdirSync(adsDir, { recursive: true });
    const ext = path.extname(imageFile.name); // .png, .jpg, ...
    const imageName = `image_${newAd._id}${ext}`;

    await imageFile.mv(path.join(adsDir, imageName));

    let iconName = "";
    if (iconFile) {
      iconName = `icon_${newAd._id}.png`;
      await iconFile.mv(path.join(adsDir, iconName));
    }

    newAd.image = imageName;
    newAd.icon = iconName;
    await newAd.save();

    res.status(201).json({ message: "Reklama yaratildi", ad: newAd });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi", error: err.message });
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

    // Barcha studentlarni oldik

    const formattedTutors = tutors.map((tutor) => {
      const groupNames = tutor.group.map((g) => g.name);

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
