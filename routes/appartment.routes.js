import express from "express";
import AppartmentModel from "../models/appartment.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import StudentModel from "../models/student.model.js";
import tutorModel from "../models/tutor.model.js";
import { uploadMultipleImages } from "../middlewares/upload.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.post(
  "/appartment/create",
  authMiddleware,
  uploadMultipleImages,
  async (req, res) => {
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

      // Multer orqali yuklangan fayllarni tekshirish
      if (
        !req.files ||
        !req.files.boilerImage ||
        !req.files.gazStove ||
        !req.files.chimney ||
        !req.files.additionImage
      ) {
        return res.status(400).json({
          status: "error",
          message: "Katyol, gazplita va Mo'ri rasmlari yuklanishi kerak",
        });
      }

      const boilerImage = req.files.boilerImage[0];
      const gazStove = req.files.gazStove[0];
      const chimney = req.files.chimney[0];
      const additionImage = req.files.additionImage[0];

      const newAppartment = new AppartmentModel({
        studentId,
        boilerImage: { url: `/public/images/${boilerImage.filename}` },
        gazStove: { url: `/public/images/${gazStove.filename}` },
        chimney: { url: `/public/images/${chimney.filename}` },
        additionImage: { url: `/public/images/${additionImage.filename}` },
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
  }
);

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
    const { appartmentId, status, chimney, gazStove, boiler, additionImage } =
      req.body;

    const findAppartment = await AppartmentModel.findById(appartmentId);
    if (!findAppartment) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday kvartira topilmadi" });
    }

    let additionImageStatus = "";
    if (additionImage) additionImageStatus = additionImage;

    await AppartmentModel.findByIdAndUpdate(appartmentId, {
      status,
      boilerImage: { ...findAppartment.boilerImage, status: boiler },
      chimney: { ...findAppartment.chimney, status: chimney },
      gazStove: { ...findAppartment.gazStove, status: gazStove },
      additionImage: {
        ...findAppartment.additionImage,
        status: additionImageStatus,
      },
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

      const tutorGroups = findTutor.group.map((g) => g.name);

      const findStudents = await StudentModel.find({
        "group.name": { $in: tutorGroups },
      });

      const appartments = await AppartmentModel.find({ current: true });
      if (!appartments.length) {
        return res.json({
          message:
            "Sizning guruhingizdagi studentlar hali ijara ma'lumotlarini qo'shmagan",
        });
      }

      const studentAppartments = findStudents
        .map((student) =>
          appartments.find(
            (c) => c.studentId.toString() === student._id.toString()
          )
        )
        .filter(Boolean);

      const uniqueAppartments = Array.from(
        new Map(
          studentAppartments.map((appartment) => [
            appartment._id.toString(),
            appartment,
          ])
        ).values()
      );

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
              total: statusCounts.green || 0,
            },
            yellow: {
              percent:
                ((statusCounts.yellow / totalCount) * 100).toFixed(2) + "%",
              total: statusCounts.yellow || 0,
            },
            red: {
              percent: ((statusCounts.red / totalCount) * 100).toFixed(2) + "%",
              total: statusCounts.red || 0,
            },
            blue: {
              percent:
                ((statusCounts.blue / totalCount) * 100).toFixed(2) + "%",
              total: statusCounts.blue || 0,
            },
          }
        : {
            green: { percent: "0%", total: 0 },
            yellow: { percent: "0%", total: 0 },
            red: { percent: "0%", total: 0 },
            blue: { percent: "0%", total: 0 },
          };

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

router.get("/faculties", async (req, res) => {
  try {
    const uniqueFaculties = await StudentModel.distinct("department.name");
    res.json({ data: uniqueFaculties });
  } catch (error) {
    res.json({ message: error.message });
  }
});

router.get("/groups", async (req, res) => {
  try {
    const { search } = req.query;
    const uniqueFaculties = await StudentModel.distinct("group.name");

    if (!search) {
      return res.json({ data: uniqueFaculties });
    }

    const filteredFaculties = uniqueFaculties.filter((faculty) =>
      faculty.toLowerCase().includes(search.toLowerCase())
    );

    res.json({ data: filteredFaculties });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/students-filter", async (req, res) => {
  try {
    const { gender, faculty, year } = req.body;

    const findStudents = await StudentModel.find({
      "department.name": faculty,
      "gender.name": gender,
    }).select(
      "full_name image birth_date district currentDistrict group level educationYear"
    );

    const filteredStudents = findStudents
      .filter((c) => {
        const birthDate = new Date(c.birth_date * 1000);
        return birthDate.getFullYear() == year;
      })
      .map((student) => {
        const birthDate = new Date(student.birth_date * 1000);
        const day = String(birthDate.getDate()).padStart(2, "0");
        const month = String(birthDate.getMonth() + 1).padStart(2, "0");
        const year = birthDate.getFullYear();
        const formattedDate = `${day}.${month}.${year}`;

        return {
          ...student._doc,
          birth_date: formattedDate,
        };
      });

    res.json({
      data: filteredStudents,
      total: filteredStudents.length,
    });
  } catch (error) {
    res.json({ message: error.message });
  }
});

router.get("/name/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const findStudents = await StudentModel.find({
      first_name: name.toLocaleUpperCase(),
    }).select("level full_name district image birth_date");

    const filteredStudents = findStudents.map((student) => {
      const birthDate = new Date(student.birth_date * 1000);
      const day = String(birthDate.getDate()).padStart(2, "0");
      const month = String(birthDate.getMonth() + 1).padStart(2, "0");
      const year = birthDate.getFullYear();
      const formattedDate = `${day}.${month}.${year}`;

      return {
        ...student._doc,
        birth_date: formattedDate,
      };
    });
    res.json({ data: filteredStudents });
  } catch (error) {
    res.json({ message: error.message });
  }
});

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
    });

    res.json({ status: "success", data: findAppartment });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Serverda xatolik yuz berdi" });
  }
});

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
          full_name: student?.full_name,
          image: student?.image,
          faculty: student?.faculty,
          group: student?.group,
          province: student?.province,
          gender: student?.gender,
          department: student?.department,
          specialty: student?.specialty,
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

router.put(
  "/appartment/:id",
  authMiddleware,
  uploadMultipleImages,
  async (req, res) => {
    try {
      const findAppartment = await AppartmentModel.findById(req.params.id);
      if (!findAppartment) {
        return res.status(400).json({
          status: "error",
          message: "Bunday ijara ma'lumotlari topilmadi",
        });
      }

      const updatedData = { ...req.body };
      console.log(updatedData);
      console.log(req.files);

      // Agar yangi rasmlar yuklangan bo'lsa
      if (req.files) {
        const handleImageUpdate = (fieldName, existingUrl) => {
          if (req.files[fieldName] && req.files[fieldName][0]) {
            // Eski rasmni o'chirish
            if (existingUrl) {
              const oldPath = path.join(__dirname, "..", existingUrl);
              if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
              }
            }
            return `/public/images/${req.files[fieldName][0].filename}.${
              req.files[fieldName][0].mimetype.split("/")[1]
            }`;
          }
          return existingUrl;
        };

        if (req.files.boilerImage) {
          updatedData.boilerImage = {
            url: handleImageUpdate(
              "boilerImage",
              findAppartment.boilerImage?.url
            ),
            status: findAppartment.boilerImage?.status || "Being checked",
          };
        }

        if (req.files.gazStove) {
          updatedData.gazStove = {
            url: handleImageUpdate("gazStove", findAppartment.gazStove?.url),
            status: findAppartment.gazStove?.status || "Being checked",
          };
        }

        if (req.files.chimney) {
          updatedData.chimney = {
            url: handleImageUpdate("chimney", findAppartment.chimney?.url),
            status: findAppartment.chimney?.status || "Being checked",
          };
        }

        if (req.files.additionImage) {
          updatedData.additionImage = {
            url: handleImageUpdate(
              "additionImage",
              findAppartment.additionImage?.url
            ),
            status: findAppartment.additionImage?.status || "Being checked",
          };
        }
      }

      // Joylashuvni alohida o'zgartirish
      if (req.body.lat && req.body.lon) {
        updatedData.location = {
          lat: req.body.lat,
          long: req.body.lon,
        };
      }

      const updateAppartment = await AppartmentModel.findByIdAndUpdate(
        req.params.id,
        { $set: updatedData },
        { new: true }
      );

      res.status(200).json({
        status: "success",
        message: "Ijara ma'lumotlari muvaffaqiyatli yangilandi",
        data: updateAppartment,
      });
    } catch (error) {
      console.error("Xatolik:", error);
      res.status(500).json({
        status: "error",
        message: "Serverda xatolik yuz berdi",
      });
    }
  }
);

router.delete("/appartment/clear", authMiddleware, async (req, res) => {
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
});

export default router;
