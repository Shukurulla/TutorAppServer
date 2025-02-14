import express from "express";
import AppartmentModel from "../models/appartment.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import path from "path";
import fs from "fs";
import fileUpload from "express-fileupload";
import { fileURLToPath } from "url";
import StudentModel from "../models/student.model.js";
import tutorModel from "../models/tutor.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.use(fileUpload());

router.post("/appartment/create", authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.body;
    const studentAppartments = await AppartmentModel.findOne({
      studentId,
      needNew: false,
    });

    if (studentAppartments) {
      return res.status(401).json({
        status: "error",
        message: "Siz oldin ijara ma'lumotlarini kiritgansiz",
      });
    }

    if (
      !req.files ||
      !req.files.boilerImage ||
      !req.files.gazStove ||
      !req.files.chimney
    ) {
      return res.status(400).json({
        status: "error",
        message: "Katyol, gazplita va Mo'ri rasmlari yuklanishi kerak",
      });
    }

    const boilerImage = req.files.boilerImage;
    const gazStove = req.files.gazStove;
    const chimney = req.files.chimney;

    const imageDir = path.join(__dirname, "../public/images");
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const boilerImageName = `${Date.now()}_boiler_${boilerImage.name}`;
    const gazStoveName = `${Date.now()}_gaz_${gazStove.name}`;
    const chimneyName = `${Date.now()}_gaz_${chimney.name}`;

    const boilerImagePath = path.join(imageDir, boilerImageName);
    const gazStovePath = path.join(imageDir, gazStoveName);
    const chimneyPath = path.join(imageDir, chimneyName);

    await boilerImage.mv(boilerImagePath);
    await gazStove.mv(gazStovePath);
    await chimney.mv(chimneyPath);

    const newAppartment = new AppartmentModel({
      studentId,
      boilerImage: `/public/images/${boilerImageName}`,
      gazStove: `/public/images/${gazStoveName}`,
      chimney: `/public/images/${chimneyName}`,
      needNew: false,
      ...req.body,
    });

    await newAppartment.save();

    res.status(201).json({
      status: "success",
      message: "Ijara ma'lumotlari muvaffaqiyatli yaratildi",
      data: newAppartment,
    });
  } catch (error) {
    console.error("Xatolik:", error);
    res.status(500).json({
      status: "error",
      message: "Serverda xatolik yuz berdi",
    });
  }
});

router.get("/appartment/all", async (req, res) => {
  try {
    const appartments = await AppartmentModel.find();
    res.json({ message: "success", data: appartments });
  } catch (error) {
    res.json({ status: "error", message: error.message });
  }
});

router.get("/appartment/by-group/:name", async (req, res) => {
  try {
    const findStudents = await StudentModel.find({
      "group.name": req.params.name,
    });

    const appartments = await AppartmentModel.find();

    const filteredAppartments = findStudents.map((student) => {
      return {
        student: {
          group: student.group,
          _id: student._id,
          image: student.image,
          full_name: student.full_name,
          faculty: student.faculty,
        },
        appartment: appartments
          .filter((item) => item.current == true)
          .filter((c) => c.studentId == student.student_id_number)[0],
      };
    });
    res.json({ status: "success", data: filteredAppartments });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.post("/appartment/check", authMiddleware, async (req, res) => {
  try {
    const { appartmentId, status } = req.body;

    const findAppartment = await AppartmentModel.findById(appartmentId);
    if (!findAppartment) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday kvartira topilmadi" });
    }
    await AppartmentModel.findByIdAndUpdate(appartmentId, {
      status,
    });
    const checkedAppartment = await AppartmentModel.findById(appartmentId);
    res.status(200).json({ status: "success", data: checkedAppartment });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.get(
  "/appertment/statistics/for-tutor",
  authMiddleware,
  async (req, res) => {
    try {
      const { userId } = req.userData;
      const findTutor = await tutorModel.findById(userId);
      if (!findTutor) {
        return res
          .status(400)
          .json({ status: "error", message: "Bunday tutor topilmadi" });
      }

      const findStudents = await StudentModel.find({
        "faculty.name": findTutor.faculty,
      });

      const appartments = await AppartmentModel.find({ current: true });

      // Studentlarga tegishli unikal apartamentlarni yig‘ish
      const studentAppartments = findStudents
        .map((student) =>
          appartments.find((c) => c.studentId === student.student_id_number)
        )
        .filter(Boolean); // Undefined bo'lganlarni olib tashlash

      // Takroriy bo‘lgan `appartment` obyektlarini olib tashlash
      const uniqueAppartments = Array.from(
        new Map(
          studentAppartments.map((appartment) => [
            appartment._id.toString(),
            appartment,
          ])
        ).values()
      );

      // Statuslar bo‘yicha foizlarni hisoblash
      const totalCount = uniqueAppartments.length;
      const statusCounts = uniqueAppartments.reduce(
        (acc, { status }) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        { green: 0, yellow: 0, red: 0 }
      );

      const statusPercentages = totalCount
        ? {
            green: ((statusCounts.green / totalCount) * 100).toFixed(2) + "%",
            yellow: ((statusCounts.yellow / totalCount) * 100).toFixed(2) + "%",
            red: ((statusCounts.red / totalCount) * 100).toFixed(2) + "%",
          }
        : { green: "0%", yellow: "0%", red: "0%" };

      res.status(200).json({
        status: "success",
        data: uniqueAppartments,
        statistics: statusPercentages,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Server xatosi" });
    }
  }
);

router.get("/appartment/new", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    // Tutorni topish
    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    // O'sha fakultetga tegishli studentlarni topish
    const findStudents = await StudentModel.find({
      "faculty.name": findTutor.faculty,
    }).select("_id");

    if (!findStudents.length) {
      return res.status(400).json({
        status: "error",
        message: "Bu fakultetda studentlar topilmadi",
      });
    }

    // Studentlarning ID larini olish
    const studentIds = findStudents.map((student) => student.student_id_number);

    // Studentlarga tegishli appartmentlarni topish
    const appartments = await AppartmentModel.find({
      student: { $in: studentIds }, // student IDlari bo'yicha filter
      current: true,
      status: "Being checked",
    });

    res.json({ status: "success", appartments });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Serverda xatolik yuz berdi" });
  }
});

// For tutor
router.get("/appartment/status/:status", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { status } = req.params;

    // Status tekshirish (OR `||` emas, AND `&&` ishlatamiz)
    if (status !== "red" && status !== "yellow" && status !== "green") {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday status mavjud emas" });
    }

    // Tutorni topish
    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    // Tutorning studentlarini topish
    const findStudents = await StudentModel.find({
      "faculty.name": findTutor.faculty,
    }).select("_id");

    if (!findStudents.length) {
      return res.status(400).json({
        status: "error",
        message: "Bu fakultetda studentlar topilmadi",
      });
    }

    // Studentlarning ID larini olish
    const studentIds = findStudents.map((student) => student.student_id_number);

    // Studentlarga tegishli appartmentlarni topish
    const appartments = await AppartmentModel.find({
      student: { $in: studentIds }, // Faqat tutorning studentlariga tegishli bo'lishi kerak
      status: status,
    });

    res.json({ status: "success", appartments });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Serverda xatolik yuz berdi" });
  }
});

export default router;
