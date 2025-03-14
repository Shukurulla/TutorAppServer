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
      boilerImage: { url: `/public/images/${boilerImageName}` },
      gazStove: { url: `/public/images/${gazStoveName}` },
      chimney: { url: `/public/images/${chimneyName}` },
      needNew: false,
      location: {
        lat: req.body.lat,
        long: req.body.lon,
      },
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
      message: error.message,
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
    const { appartmentId, status, chimney, gazStove, boiler } = req.body;

    const findAppartment = await AppartmentModel.findById(appartmentId);
    if (!findAppartment) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday kvartira topilmadi" });
    }

    await AppartmentModel.findByIdAndUpdate(appartmentId, {
      status,
      boilerImage: { ...findAppartment.boilerImage, status: boiler },
      chimney: { ...findAppartment.chimney, status: chimney },
      gazStove: { ...findAppartment.gazStove, status: gazStove },
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

      // Tutorning barcha guruhlarini olish
      const tutorGroups = findTutor.group.map((g) => g.name);

      const findStudents = await StudentModel.find({
        "group.name": { $in: tutorGroups }, // Tutorning barcha guruhlariga tegishli studentlarni topish
      });

      const appartments = await AppartmentModel.find({ current: true });
      if (!appartments.length) {
        return res.json({
          message:
            "Sizning guruhingizdagi studentlar hali ijara ma'lumotlarini qo‘shmagan",
        });
      }

      // Studentlarga tegishli apartamentlarni yig‘ish
      const studentAppartments = findStudents
        .map((student) =>
          appartments.find(
            (c) => c.studentId.toString() === student._id.toString()
          )
        )
        .filter(Boolean); // Undefined bo'lganlarni olib tashlash

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
          if (status === "Being checked") {
            acc.blue += 1;
          } else {
            acc[status] = (acc[status] || 0) + 1;
          }
          return acc;
        },
        { green: 0, yellow: 0, red: 0, blue: 0 }
      );

      const statusPercentages = totalCount
        ? {
            green: {
              percent:
                ((statusCounts.green / totalCount) * 100).toFixed(2) + "%",
              total: statusCounts.green,
            },
            yellow: {
              percent:
                ((statusCounts.yellow / totalCount) * 100).toFixed(2) + "%",
              total: statusCounts.yellow,
            },
            red: {
              percent: ((statusCounts.red / totalCount) * 100).toFixed(2) + "%",
              total: statusCounts.red,
            },
            blue: {
              percent:
                ((statusCounts.blue / totalCount) * 100).toFixed(2) + "%",
              total: statusCounts.blue,
            },
          }
        : { green: "0%", yellow: "0%", red: "0%", blue: "0%" };

      res.status(200).json({
        status: "success",
        statistics: statusPercentages,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Server xatosi" });
    }
  }
);

router.get("/appartment/all-delete", async (req, res) => {
  try {
    const appartments = await AppartmentModel.find();
    for (let i = 0; i < appartments.length; i++) {
      await AppartmentModel.findByIdAndDelete(appartments[i]._id);
    }
    res.json(appartments);
  } catch (error) {
    res.json({ message: error.message });
  }
});

router.get("/appartment/new/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const findStudent = await StudentModel.findById(id).select("_id");

    if (!findStudent) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday student topilmadi" });
    }

    const findAppartment = await AppartmentModel.find({
      studentId: id,
      status: "Being checked",
    });

    res.json({ status: "success", data: findAppartment });
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
    let { page = 1, limit = 20 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (!["red", "yellow", "green", "blue"].includes(status)) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday status mavjud emas" });
    }

    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const tutorGroups = findTutor.group.map((g) => g.name);

    const findStudents = await StudentModel.find({
      "group.name": { $in: tutorGroups },
    });

    if (!findStudents.length) {
      return res.status(400).json({
        status: "error",
        message: "Bu guruhlarda studentlar topilmadi",
      });
    }

    const appartments = await AppartmentModel.find({
      current: true,
      status: status === "blue" ? "Being checked" : status,
      studentId: { $in: findStudents.map((s) => s._id) },
    })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await AppartmentModel.countDocuments({
      current: true,
      status: status === "blue" ? "Being checked" : status,
      studentId: { $in: findStudents.map((s) => s._id) },
    });

    const totalPages = Math.ceil(total / limit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    const withStudent = appartments.map((item) => {
      const student = findStudents.find(
        (c) => c._id.toString() === item.studentId.toString()
      );
      return {
        student: {
          full_name: student.full_name,
          image: student.image,
          faculty: student.faculty,
          group: student.group,
        },
        appartment: item,
      };
    });

    res.json({
      status: "success",
      data: withStudent,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        nextPage,
        prevPage,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Serverda xatolik yuz berdi" });
  }
});

router.delete("/appartment/clear", authMiddleware, async (req, res) => {
  try {
    const deletes = async () => {
      try {
        const appartments = await AppartmentModel.find();
        for (let i = 0; i < appartments.length; i++) {
          await AppartmentModel.findByIdAndDelete(appartments[i]._id);
        }
        res
          .status(200)
          .json({ status: "success", message: "Ijara malumotlari tozalandi" });
      } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
      }
    };

    deletes();
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
