import express from "express";
import StudentModel from "../models/student.model.js";
import axios from "axios";
import generateToken from "../utils/token.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import AppartmentModel from "../models/appartment.model.js";

const router = express.Router();

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
      data: appartments.filter((c) => c.status != "Being checked"),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
