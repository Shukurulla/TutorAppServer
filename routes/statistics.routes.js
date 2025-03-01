import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import adminModel from "../models/admin.model.js";
import AppartmentModel from "../models/appartment.model.js";
import StudentModel from "../models/student.model.js";
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

router.get("/statistics/appartments/map", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    isAdmin(userId, res);
    const appartments = await AppartmentModel.find({ current: true }).select(
      "location status"
    );
    res.status(200).json({
      status: "success",
      data: appartments.filter((c) => c.status !== "Being checked"),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

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
      isAdmin(userId, res);
      const appartments = await AppartmentModel.find({ current: true }).select(
        "status typeOfBoiler"
      );

      const boilerTypes = [
        "Ariston kotyol",
        "Qo'l bo'la kotyol",
        "Qo'l bo'la pech",
        "Elektropech",
        "Konditsioner",
        "Isitish uskunasi yo'q",
      ];

      const filteredAppartments = boilerTypes.map((item) => {
        return {
          title: item,
          total: appartments
            .filter((c) => c.status != "Being checked")
            .filter((c) => c.typeOfBoiler == item).length,
        };
      });
      res.json({
        status: "success",
        data: filteredAppartments,
      });
    } catch (error) {
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
      isAdmin(userId, res);
      const appartments = await AppartmentModel.find({ current: true }).select(
        "status smallDistrict"
      );

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

      const filteredAppartments = smallDistricts.map((item) => {
        return {
          title: item,
          total: appartments
            .filter((c) => c.status != "Being checked")
            .filter((c) => c.smallDistrict.trim() == item.trim()).length,
        };
      });
      res.json({
        status: "success",
        data: filteredAppartments,
      });
    } catch (error) {
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

router.get("/statistics/students/all", async (req, res) => {
  try {
    const students = await StudentModel.find();
    res.json({ status: "success", data: students });
  } catch (error) {
    res.json({ status: "error", message: error.message });
  }
});

export default router;
