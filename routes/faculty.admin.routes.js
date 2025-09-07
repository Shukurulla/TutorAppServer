import express from "express";
import facultyAdminModel from "../models/faculty.admin.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";

const router = express.Router();

const { get, post, put } = router;

post("/create", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, login, password, faculties } = req.body;
    if (
      !firstName ||
      !lastName ||
      !password ||
      typeof faculties !== "object" ||
      !faculties
    ) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos maydonlarni toliq kiriting",
      });
    }

    const isExistFacultyAdmin = await facultyAdminModel.findOne({ login });
    if (isExistFacultyAdmin) {
      return res.status(400).json({
        status: "error",
        message: "Bunday fakultet admin oldin ro'yhatdan o'tgan",
      });
    }
    const facultyAdmin = await facultyAdminModel.create(req.body);

    res.status(200).json({
      status: "success",
      message: "Fakultet admin muaffaqiyatli qo'shildi",
      data: facultyAdmin,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

get("/list", authMiddleware, async (req, res) => {
  try {
    const facultyAdmins = await facultyAdminModel.find();
    res.status(200).json({ status: "success", data: facultyAdmins });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

get("/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findFacultyAdmin = await facultyAdminModel.findById(userId);

    if (!findFacultyAdmin) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday fakultet admin topilmadi" });
    }
    res.status(200).json({ status: "success", data: findFacultyAdmin });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

post("/tutor-create", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findFacultyAdmin = await facultyAdminModel.findById(userId);
    if (!findFacultyAdmin) {
      return res
        .status(401)
        .json({ status: "error", message: "Siz fakultet admini emassiz" });
    }

    const { login, name, phone, password, group } = req.body;

    if (
      !login ||
      !name ||
      !phone ||
      !password ||
      typeof group != "object" ||
      !group
    ) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos barcha maydonlarni toliq kiriting",
      });
    }

    const tutor = await tutorModel.create({
      ...req.body,
      facultetAdmin: userId,
    });
    res.status(200).json({ status: "success", data: tutor });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

get("/my-tutors", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findFacultyAdmin = await facultyAdminModel.findById(userId);
    if (!findFacultyAdmin) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday fakultet admin topilmadi" });
    }

    const findTutors = await tutorModel.find({ facultyAdmin: userId });

    res.status(200).json({ status: "success", data: findTutors });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

get("/");

export default router;
