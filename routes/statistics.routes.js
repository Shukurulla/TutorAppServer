import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import adminModel from "../models/admin.model.js";
import AppartmentModel from "../models/appartment.model.js";
import StudentModel from "../models/student.model.js";
import facultyAdminModel from "../models/faculty.admin.model.js";
import {
  requireFacultyAdmin,
  requireMainAdmin,
} from "../middlewares/auth.middleware.js";
import axios from "axios";
import { config } from "dotenv";
config();

const router = express.Router();

function getStudentCountByLevel(data) {
  const result = {};

  Object.values(data.level).forEach((degree) => {
    Object.entries(degree).forEach(([course, students]) => {
      if (!result[course]) {
        result[course] = 0;
      }
      result[course] += Object.values(students).reduce(
        (sum, count) => sum + count,
        0
      );
    });
  });

  return Object.entries(result).map(([level, total]) => ({ level, total }));
}

const isAdmin = async (id, res) => {
  const findAdmin = await adminModel.findById(id);

  if (!findAdmin) {
    return res
      .status(401)
      .json({ status: "error", message: "Bunday admin topilmadi" });
  }
};

router.get("/statistics/students/gender", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    isAdmin(userId, res);
    const { data } = await axios.get(
      `https://student.karsu.uz/rest/v1/public/stat-student`
    );
    res.json({ status: "success", data: data.data.education_type.Jami });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// routes/statistics.routes.js - appartments/map endpoint yangilash
router.get("/statistics/appartments/map", authMiddleware, async (req, res) => {
  try {
    const { userId, role } = req.userData;
    console.log("Map endpoint called - role:", role);

    let query = {
      status: { $ne: "Being checked" },
      location: { $exists: true },
      "location.lat": { $exists: true, $ne: null, $ne: "" },
      "location.long": { $exists: true, $ne: null, $ne: "" },
    };

    // Faculty admin uchun faqat o'z fakulteti studentlari
    if (role === "facultyAdmin") {
      const facultyAdmin = await facultyAdminModel.findById(userId);
      if (!facultyAdmin) {
        return res.status(404).json({
          status: "error",
          message: "Fakultet admin topilmadi",
        });
      }

      const facultyNames = facultyAdmin.faculties.map((f) => f.name);

      // Faculty admin fakultetlaridagi studentlarni olish
      const students = await StudentModel.find({
        "department.name": { $in: facultyNames },
      }).select("_id");

      const studentIds = students.map((s) => s._id);
      query.studentId = { $in: studentIds };

      console.log(
        `Faculty admin: ${facultyNames.join(", ")} - ${
          studentIds.length
        } students`
      );
    }

    const allAppartments = await AppartmentModel.find(query)
      .select("location status _id studentId createdAt")
      .sort({ createdAt: -1 });

    console.log(
      `Found ${allAppartments.length} valid apartments for role: ${role}`
    );

    // Har bir student uchun eng oxirgi appartmentni olish
    const studentMap = new Map();

    for (const apartment of allAppartments) {
      const studentId = apartment.studentId.toString();

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, apartment);
      } else {
        const existing = studentMap.get(studentId);
        if (new Date(apartment.createdAt) > new Date(existing.createdAt)) {
          studentMap.set(studentId, apartment);
        }
      }
    }

    const latestAppartments = Array.from(studentMap.values());
    console.log(`Final apartments for map: ${latestAppartments.length}`);

    const formattedData = latestAppartments.map((apt) => ({
      _id: apt._id,
      studentId: apt.studentId,
      status: apt.status,
      location: {
        lat: apt.location.lat,
        long: apt.location.long,
      },
    }));

    res.status(200).json({
      status: "success",
      data: formattedData,
      total: formattedData.length,
      message: `${formattedData.length} ta apartment topildi`,
    });
  } catch (error) {
    console.error("Map endpoint error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get(
  "/statistics/faculty-admin/students",
  authMiddleware,
  requireFacultyAdmin,
  async (req, res) => {
    try {
      const { userId } = req.userData;

      // Faculty admin profilini olish
      const facultyAdmin = await facultyAdminModel.findById(userId);
      if (!facultyAdmin) {
        return res.status(404).json({
          status: "error",
          message: "Fakultet admin topilmadi",
        });
      }

      // Fakultet nomlarini olish
      const facultyNames = facultyAdmin.faculties.map((f) => f.name);

      // Shu fakultetlardagi studentlarni olish
      const students = await StudentModel.find({
        "department.name": { $in: facultyNames },
      }).select("gender department group level");

      // Jins bo'yicha statistika
      const genderStats = students.reduce((acc, student) => {
        const gender = student.gender?.name || "Noma'lum";
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      }, {});

      // Kurs bo'yicha statistika
      const levelStats = students.reduce((acc, student) => {
        const level = student.level?.name || "Noma'lum";
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});

      // Fakultet bo'yicha statistika
      const facultyStats = students.reduce((acc, student) => {
        const faculty = student.department?.name || "Noma'lum";
        acc[faculty] = (acc[faculty] || 0) + 1;
        return acc;
      }, {});

      res.json({
        status: "success",
        data: {
          total: students.length,
          genderStats,
          levelStats,
          facultyStats,
          faculties: facultyNames,
        },
      });
    } catch (error) {
      console.error("Faculty admin statistics error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

// Faculty admin uchun ijara statistikasi
router.get(
  "/statistics/faculty-admin/appartments",
  authMiddleware,
  requireFacultyAdmin,
  async (req, res) => {
    try {
      const { userId } = req.userData;

      // Faculty admin profilini olish
      const facultyAdmin = await facultyAdminModel.findById(userId);
      if (!facultyAdmin) {
        return res.status(404).json({
          status: "error",
          message: "Fakultet admin topilmadi",
        });
      }

      // Fakultet nomlarini olish
      const facultyNames = facultyAdmin.faculties.map((f) => f.name);

      // Shu fakultetlardagi studentlarni olish
      const students = await StudentModel.find({
        "department.name": { $in: facultyNames },
      }).select("_id");

      const studentIds = students.map((s) => s._id);

      // Ijara ma'lumotlarini olish
      const appartments = await AppartmentModel.find({
        studentId: { $in: studentIds },
        status: { $ne: "Being checked" },
      });

      // Status bo'yicha statistika
      const statusStats = appartments.reduce((acc, apt) => {
        const status = apt.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      res.json({
        status: "success",
        data: {
          totalStudents: students.length,
          totalAppartments: appartments.length,
          studentsWithAppartments: appartments.length,
          studentsWithoutAppartments: students.length - appartments.length,
          statusStats,
        },
      });
    } catch (error) {
      console.error("Faculty admin appartments statistics error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/statistics/appartments/level",
  authMiddleware,
  async (req, res) => {
    try {
      const { userId } = req.userData;
      isAdmin(userId, res);
      const { data } = await axios.get(
        `https://student.karsu.uz/rest/v1/public/stat-student`
      );
      const totalStudents = getStudentCountByLevel(data.data);
      res.status(200).json({ status: "success", data: totalStudents });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/statistics/appartment/boiler",
  authMiddleware,
  async (req, res) => {
    try {
      const { userId } = req.userData;
      await isAdmin(userId, res);

      // Aggregation pipeline yordamida optimizatsiya
      const boilerStats = await AppartmentModel.aggregate([
        // Faqat "Being checked" bo'lmagan appartmentlarni olish
        {
          $match: {
            status: { $ne: "Being checked" },
            typeOfBoiler: { $exists: true, $ne: null },
          },
        },
        // Har bir student uchun eng oxirgi appartmentni olish
        {
          $sort: { studentId: 1, createdAt: -1 },
        },
        {
          $group: {
            _id: "$studentId",
            latestAppartment: { $first: "$$ROOT" },
          },
        },
        // typeOfBoiler bo'yicha guruhlash
        {
          $group: {
            _id: "$latestAppartment.typeOfBoiler",
            count: { $sum: 1 },
          },
        },
      ]);

      const boilerTypes = [
        "Ariston kotyol",
        "Qo'l bo'la kotyol",
        "Qo'l bo'la pech",
        "Elektropech",
        "Konditsioner",
        "Isitish uskunasi yo'q",
      ];

      // Natijalarni formatlash
      const result = boilerTypes.map((boilerType) => {
        const found = boilerStats.find((stat) => stat._id === boilerType);
        return {
          title: boilerType,
          total: found ? found.count : 0,
        };
      });

      // Debug uchun log
      console.log("Boiler statistics:", result);
      console.log("Raw aggregation result:", boilerStats);

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      console.error("Boiler statistics error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get(
  "/statistics/appartment/smallDistrict",
  authMiddleware,
  async (req, res) => {
    try {
      const { userId } = req.userData;
      await isAdmin(userId, res);

      // Aggregation pipeline yordamida optimizatsiya
      const districtStats = await AppartmentModel.aggregate([
        // Faqat "Being checked" bo'lmagan appartmentlarni olish
        {
          $match: {
            status: { $ne: "Being checked" },
            smallDistrict: { $exists: true, $ne: null, $ne: "" },
          },
        },
        // Har bir student uchun eng oxirgi appartmentni olish
        {
          $sort: { studentId: 1, createdAt: -1 },
        },
        {
          $group: {
            _id: "$studentId",
            latestAppartment: { $first: "$$ROOT" },
          },
        },
        // smallDistrict bo'yicha guruhlash (trim qilish uchun)
        {
          $addFields: {
            trimmedDistrict: {
              $trim: { input: "$latestAppartment.smallDistrict" },
            },
          },
        },
        {
          $group: {
            _id: "$trimmedDistrict",
            count: { $sum: 1 },
          },
        },
      ]);

      const smallDistricts = [
        "20 - kichik tuman",
        "21 - kichik tuman",
        "22 - kichik tuman",
        "23 - kichik tuman",
        "24 - kichik tuman",
        "25 - kichik tuman",
        "26 - kichik tuman",
        "27 - kichik tuman",
        "28 - kichik tuman",
      ];

      // Natijalarni formatlash
      const result = smallDistricts.map((district) => {
        const found = districtStats.find((stat) => stat._id === district);
        return {
          title: district,
          total: found ? found.count : 0,
        };
      });

      // Debug uchun log
      console.log("SmallDistrict statistics:", result);
      console.log("Raw aggregation result:", districtStats);

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      console.error("SmallDistrict statistics error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.get("/statistics/region", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    isAdmin(userId, res);
    const { data } = await axios.get(
      `https://student.karsu.uz/rest/v1/public/stat-student`
    );
    const transformData = (data) => {
      return Object.entries(data.region).map(([region, values]) => ({
        region,
        total: values.Bakalavr + values.Magistr,
      }));
    };

    res.status(200).json({ status: "success", data: transformData(data.data) });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/appartment/student-info/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const findAppartment = await AppartmentModel.findById(id);
    if (!findAppartment) {
      return res.status(401).json({
        status: "error",
        message: "Bunday ijara malumotlari topilmadi",
      });
    }
    const findStudent = await StudentModel.findById(
      findAppartment.studentId
    ).select("image second_name province level first_name");
    const dataSchema = {
      appartment: findAppartment,
      student: findStudent,
    };
    res.status(200).json({ status: "success", data: dataSchema });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/statistics/students/all", async (req, res) => {
  try {
    const students = await StudentModel.find();
    res.json({ status: "success", data: students });
  } catch (error) {
    res.json({ status: "error", message: error.message });
  }
});

router.post(
  "/statistics/appartment/filter",
  authMiddleware,
  async (req, res) => {
    try {
      const { status, smallDistrict, province, course } = req.body;

      let studentFilter = {};

      // Student filter yaratish
      if (province) studentFilter["province.name"] = province;
      if (course) studentFilter["level.name"] = course;

      // Studentlarni topish
      let targetStudents = [];
      if (province || course) {
        targetStudents = await StudentModel.find(studentFilter, "_id");
      } else {
        targetStudents = await StudentModel.find({}, "_id");
      }

      if (targetStudents.length === 0) {
        return res.json({
          status: "success",
          data: [],
        });
      }

      // Har bir student uchun eng oxirgi appartmentni topish
      const filteredAppartments = [];
      for (const student of targetStudents) {
        let appartmentFilter = { studentId: student._id };

        // Appartment filter qo'shish
        if (status) appartmentFilter.status = status;
        if (smallDistrict) appartmentFilter.smallDistrict = smallDistrict;

        const latestAppartment = await AppartmentModel.findOne(appartmentFilter)
          .select("location status")
          .sort({ createdAt: -1 });

        if (latestAppartment) {
          filteredAppartments.push(latestAppartment);
        }
      }

      res.json({
        status: "success",
        data: filteredAppartments.filter((c) => c.status !== "Being checked"),
      });
    } catch (error) {
      console.error("Xatolik:", error);
      res
        .status(500)
        .json({ status: "error", message: "Internal Server Error" });
    }
  }
);

router.post("/statistics/faculty-data", authMiddleware, async (req, res) => {
  try {
    const { faculty } = req.body; // Filter ma'lumotlari body orqali keladi

    const matchStage = {
      "accommodation.name": { $ne: "O'z uyida" }, // "O'z uyida" bo'lmagan talabalar
    };

    if (faculty?.length) {
      matchStage["department.name"] = { $in: faculty }; // Faqat tanlangan fakultetlar
    }

    const facultyStats = await StudentModel.aggregate([
      { $match: matchStage }, // Faqat kerakli studentlarni olish
      {
        $lookup: {
          from: "appartments", // AppartmentModel bilan bog'lash
          localField: "_id",
          foreignField: "studentId",
          as: "rentedInfo",
        },
      },
      {
        $addFields: {
          hasRentedInfo: { $gt: [{ $size: "$rentedInfo" }, 0] },
        },
      },
      {
        $group: {
          _id: "$department.name", // Fakultet bo'yicha guruhlash
          jami: { $sum: 1 }, // Har bir fakultet bo'yicha umumiy studentlar soni
          ijarada: {
            $sum: {
              $cond: {
                if: "$hasRentedInfo",
                then: 1,
                else: 0,
              },
            },
          }, // Ijarada yashovchi talabalar sonini hisoblash
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id", // Fakultet nomi
          jami: 1, // Jami talabalar soni
          ijarada: 1, // Ijarada yashovchilar soni
        },
      },
    ]);

    res.json(facultyStats);
  } catch (error) {
    console.error("Error fetching faculty statistics:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
});

export default router;
