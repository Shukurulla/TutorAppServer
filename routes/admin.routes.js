import express from "express";
import adminModel from "../models/admin.model.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/token.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";
const router = express.Router();

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
    res.status(201).json({ status: "success", data: tutors });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
