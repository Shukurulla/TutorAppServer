import express from "express";
import AppartmentModel from "../models/appartment.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import StudentModel from "../models/student.model.js";
import tutorModel from "../models/tutor.model.js";
import { uploadMultipleImages } from "../middlewares/upload.middleware.js";
import NotificationModel from "../models/notification.model.js";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.post(
  "/appartment/create",
  authMiddleware,
  uploadMultipleImages,
  async (req, res) => {
    try {
      const { studentId, typeAppartment } = req.body;

      // Studentning current appartmenti bor-yo'qligini tekshirish
      const currentAppartment = await AppartmentModel.findOne({
        studentId,
        current: true,
        needNew: false,
      });

      if (currentAppartment) {
        return res.status(401).json({
          status: "error",
          message: "Siz oldin ijara ma'lumotlarini kiritgansiz",
        });
      }

      if (typeAppartment == "tenant") {
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
          current: true, // Yangi appartment current bo'ladi
          location: {
            lat: req.body.lat,
            long: req.body.lon,
          },
          ...req.body,
        });

        await newAppartment.save();
        await NotificationModel.deleteMany({ userId: studentId });
        await NotificationModel.create({
          userId: studentId,
          notification_type: "report",
          message: "Tekshirilmoqda",
          status: "blue",
          appartmentId: newAppartment._id,
        });

        return res.status(201).json({
          status: "success",
          message: "Ijara ma'lumotlari muvaffaqiyatli yaratildi",
          data: newAppartment,
        });
      }

      if (typeAppartment == "relative" || typeAppartment == "littleHouse") {
        const {
          studentId,
          studentPhoneNumber,
          appartmentOwnerName,
          appartmentOwnerPhone,
          typeAppartment,
          permission,
        } = req.body;

        const appartment = await AppartmentModel.create({
          studentId,
          studentPhoneNumber,
          appartmentOwnerName,
          appartmentOwnerPhone,
          typeAppartment,
          permission,
        });

        const filterAppartment = {
          studentPhoneNumber: appartment.studentPhoneNumber,
          studentId: appartment.studentId,
          appartmentOwnerName: appartment.appartmentOwnerName,
          appartmentOwnerPhone: appartment.appartmentOwnerPhone,
          typeAppartment: appartment.typeAppartment,
          createdAt: appartment.createdAt,
          updatedAt: appartment.updatedAt,
          _id: appartment._id,
          permission: appartment.appartment,
        };
        return res
          .status(200)
          .json({ status: "success", data: filterAppartment });
      }

      if (typeAppartment == "bedroom") {
        const {
          studentId,
          bedroomNumber,
          permission,
          roomNumber,
          studentPhoneNumber,
        } = req.body;

        const appartment = await AppartmentModel.create({
          studentPhoneNumber,
          studentId,
          permission,
          bedroom: {
            bedroomNumber: bedroomNumber.toString(),
            roomNumber: roomNumber.toString(),
          },
          typeAppartment,
        });

        const filterAppartment = {
          studentPhoneNumber: appartment.studentPhoneNumber,
          bedroom: appartment.bedroom,
          typeAppartment: appartment.typeAppartment,
          _id: appartment._id,
          studentId: appartment.studentId,
          createdAt: appartment.createdAt,
          permission: appartment.permission,
          updatedAt: appartment.updatedAt,
        };
        return res.status(201).json({
          status: "success",
          message: "Ijara ma'lumotlari muvaffaqiyatli yaratildi",
          data: filterAppartment,
        });
      }
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

    const appartments = await AppartmentModel.find({
      typeAppartment: "tenant",
    }).select("-bedroom");

    const filteredAppartments = findStudents.map((student) => {
      // Eng oxirgi appartmentni topish
      const studentAppartments = appartments
        .filter((c) => c.studentId == student.student_id_number)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        student: {
          group: student.group,
          _id: student._id,
          image: student.image,
          full_name: student.full_name,
          faculty: student.faculty,
        },
        appartment: studentAppartments[0] || null,
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
    const { appartmentId, chimney, gazStove, boiler, additionImage } = req.body;

    let status = null;

    if ([chimney, gazStove, boiler].includes("red")) {
      status = "red";
    } else if ([chimney, gazStove, boiler].includes("yellow")) {
      status = "yellow";
    } else {
      status = "green";
    }

    const findAppartment = await AppartmentModel.findById(appartmentId).select(
      "-bedroom "
    );
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

    await NotificationModel.deleteMany({ appartmentId, status: "blue" });

    const checkedAppartment = await AppartmentModel.findById(appartmentId);
    res.status(200).json({ status: "success", data: checkedAppartment });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

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
    const uniqueFaculties = await StudentModel.distinct("group");

    if (!search) {
      return res.json({ data: uniqueFaculties });
    }

    const filteredFaculties = uniqueFaculties.filter((faculty) =>
      faculty.name.toLowerCase().includes(search.toLowerCase())
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
      return res.status(401).json({
        status: "error",
        message: "Bunday status mavjud emas",
      });
    }

    const findTutor = await tutorModel.findById(userId).lean();
    if (!findTutor) {
      return res.status(400).json({
        status: "error",
        message: "Bunday tutor topilmadi",
      });
    }

    // tutor group nomlari
    const tutorGroups = findTutor.group.map((g) => g.name);

    // faqat kerakli fieldlarni olish
    const students = await StudentModel.find({
      "group.name": { $in: tutorGroups },
    })
      .select(
        "full_name image faculty group province gender department specialty"
      )
      .lean();

    if (!students.length) {
      return res.status(400).json({
        status: "error",
        message: "Bu guruhlarda studentlar topilmadi",
      });
    }

    const studentIds = students.map((s) => s._id);
    const queryStatus = status === "blue" ? "Being checked" : status;

    // barcha kerakli appartments
    const appartments = await AppartmentModel.find({
      studentId: { $in: studentIds },
      typeAppartment: "tenant",
      status: queryStatus,
    })
      .sort({ createdAt: -1 }) // oxirgilarni oldin
      .lean();

    // Har bir student uchun eng so‘nggi appartmentni olish
    const latestAppartmentsMap = new Map();
    for (const appartment of appartments) {
      const key = appartment.studentId.toString();
      if (!latestAppartmentsMap.has(key)) {
        latestAppartmentsMap.set(key, appartment);
      }
    }

    // Result yasash
    const result = [];
    for (const student of students) {
      const appartment = latestAppartmentsMap.get(student._id.toString());
      if (appartment) {
        result.push({
          student,
          appartment,
        });
      }
    }

    // Pagination
    const total = result.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = result.slice(startIndex, endIndex);

    res.json({
      status: "success",
      data: paginatedData,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Serverda xatolik yuz berdi",
    });
  }
});

router.get(
  "/appartment/my-appartments/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      const findStudent = await StudentModel.findById(id);
      if (!findStudent) {
        return res
          .status(400)
          .json({ status: "error", message: "Bunday student topilmadi" });
      }

      const findAppartments = await AppartmentModel.find({ studentId: id });

      res.status(200).json({ status: "success", data: findAppartments });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.put(
  "/appartment/:id",
  authMiddleware,
  uploadMultipleImages,
  async (req, res) => {
    try {
      const { userId } = req.userData;

      const findAppartment = await AppartmentModel.findById(req.params.id);
      if (!findAppartment) {
        return res.status(400).json({
          status: "error",
          message: "Bunday ijara ma'lumotlari topilmadi",
        });
      }

      const updatedData = { ...req.body };
      console.log("Body ma'lumotlari:", updatedData);
      console.log("Yuklangan fayllar:", req.files);

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
            // Yangi rasm URL ini to'g'ri formatda qaytarish
            return `/public/images/${req.files[fieldName][0].filename}`;
          }
          return existingUrl;
        };

        // Har bir rasm turini alohida tekshirish va yangilash
        if (req.files.boilerImage && req.files.boilerImage[0]) {
          updatedData.boilerImage = {
            url: handleImageUpdate(
              "boilerImage",
              findAppartment.boilerImage?.url
            ),
            status: "Being checked", // Yangi rasm yuklanganda status qayta tekshiriladi
          };
        }

        if (req.files.gazStove && req.files.gazStove[0]) {
          updatedData.gazStove = {
            url: handleImageUpdate("gazStove", findAppartment.gazStove?.url),
            status: "Being checked", // Yangi rasm yuklanganda status qayta tekshiriladi
          };
        }

        if (req.files.chimney && req.files.chimney[0]) {
          updatedData.chimney = {
            url: handleImageUpdate("chimney", findAppartment.chimney?.url),
            status: "Being checked", // Yangi rasm yuklanganda status qayta tekshiriladi
          };
        }

        if (req.files.additionImage && req.files.additionImage[0]) {
          updatedData.additionImage = {
            url: handleImageUpdate(
              "additionImage",
              findAppartment.additionImage?.url
            ),
            status: "Being checked", // Yangi rasm yuklanganda status qayta tekshiriladi
          };
        }
      }

      // Joylashuvni alohida o'zgartirish
      if (req.body.lat && req.body.lon) {
        updatedData.location = {
          lat: req.body.lat,
          long: req.body.lon,
        };

        // Body dan lat va lon ni o'chirish (chunki location objekti bor)
        delete updatedData.lat;
        delete updatedData.lon;
      }

      // Agar biron bir rasm yangilangan bo'lsa, umumiy statusni ham "Being checked" qilish
      if (req.files && Object.keys(req.files).length > 0) {
        updatedData.status = "Being checked";
      }

      console.log("Yangilanayotgan ma'lumotlar:", updatedData);

      const updateAppartment = await AppartmentModel.findByIdAndUpdate(
        req.params.id,
        { $set: updatedData },
        { new: true }
      );

      console.log(updatedData.notificationId);

      if (req.body.notificationId) {
        await NotificationModel.findByIdAndDelete(
          req.body.notificationId.replace(/"/g, "")
        );
      }

      await NotificationModel.create({
        userId,
        notification_type: "report",
        message: "Tekshirilmoqda",
        status: "blue",
        appartmentId: req.params.id,
      });

      res.status(200).json({
        status: "success",
        message: "Ijara ma'lumotlari muvaffaqiyatli yangilandi",
        data: updateAppartment,
      });
    } catch (error) {
      console.error("Appartment yangilashda xatolik:", error);
      res.status(500).json({
        status: "error",
        message: "Serverda xatolik yuz berdi",
        error: error.message,
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

router.get(
  "/appartment/type/:type/:groupId",
  authMiddleware,
  async (req, res) => {
    try {
      const { type, groupId } = req.params;
      const students = await StudentModel.find({ "group.id": groupId }).select(
        "_id"
      );
      let appartments = [];
      for (let i = 0; i < students.length; i++) {
        const findAppartments = await AppartmentModel.find({
          typeAppartment: type,
        });
        appartments = await [...appartments, findAppartments];
      }
      res.status(200).json({ status: "success", data: appartments });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

export default router;
