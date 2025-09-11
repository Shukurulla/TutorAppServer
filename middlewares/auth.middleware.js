// middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import adminModel from "../models/admin.model.js";
import facultyAdminModel from "../models/faculty.admin.model.js";
import tutorModel from "../models/tutor.model.js";
import StudentModel from "../models/student.model.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authorization header mavjud emas",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token mavjud emas",
      });
    }

    // Token ni verify qilish
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Avval main adminni tekshirish
    const mainAdmin = await adminModel.findById(decoded.userId);
    if (mainAdmin) {
      req.userData = {
        userId: mainAdmin._id,
        role: "mainAdmin",
        username: mainAdmin.username,
      };
      return next();
    }

    // Agar main admin topilmasa, faculty adminni tekshirish
    const facultyAdmin = await facultyAdminModel.findById(decoded.userId);
    if (facultyAdmin) {
      req.userData = {
        userId: facultyAdmin._id,
        role: "facultyAdmin",
        login: facultyAdmin.login,
        faculties: facultyAdmin.faculties,
      };
      return next();
    }

    const tutor = await tutorModel.findById(decoded.userId);
    if (tutor) {
      req.userData = {
        userId: tutor._id,
        role: "tutor",
      };
      return next();
    }
    const student = await StudentModel.findById(decoded.userId);
    if (student) {
      req.userData = {
        userId: student._id,
      };
      return next();
    }

    // Hech qanday admin topilmasa
    return res.status(401).json({
      message: "Foydalanuvchi topilmadi",
    });
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Noto'g'ri token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token muddati tugagan",
      });
    }

    return res.status(401).json({
      message: "Autentifikatsiya amalga oshmadi",
    });
  }
};

// Role-based middleware
export const requireMainAdmin = (req, res, next) => {
  if (req.userData?.role !== "mainAdmin") {
    return res.status(403).json({
      message: "Faqat main admin uchun ruxsat berilgan",
    });
  }
  next();
};

export const requireFacultyAdmin = (req, res, next) => {
  if (req.userData?.role !== "facultyAdmin") {
    return res.status(403).json({
      message: "Faqat fakultet admin uchun ruxsat berilgan",
    });
  }
  next();
};

export const requireAnyAdmin = (req, res, next) => {
  if (!["mainAdmin", "facultyAdmin"].includes(req.userData?.role)) {
    return res.status(403).json({
      message: "Admin huquqi talab qilinadi",
    });
  }
  next();
};

export default authMiddleware;
