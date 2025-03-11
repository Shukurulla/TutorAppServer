import express from "express";
import tutorModel from "../models/tutor.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import adminModel from "../models/admin.model.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/token.js";
import StudentModel from "../models/student.model.js";
const router = express.Router();

router.post("/tutor/create", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { login, password, group, name } = req.body;

    const findAdmin = await adminModel.findById(userId);
    if (!findAdmin) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday admin topilmadi" });
    }

    if (!login || !password || !group || !Array.isArray(group)) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos, barcha ma'lumotlarni to'g'ri kiriting",
      });
    }

    const findTutor = await tutorModel.findOne({ login });
    if (findTutor) {
      return res.status(400).json({
        status: "error",
        message: "Bu tutor oldin ro'yxatdan o'tgan",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const tutor = await tutorModel.create({
      login,
      group, // <-- Endi bu array sifatida keladi va saqlanadi
      name,
      password: hashedPassword,
    });

    res.status(200).json({ status: "success", data: tutor });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.post("/tutor/login", async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos Malumotlarni toliq kiriting",
      });
    }
    const findTutor = await tutorModel.findOne({ login });
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const students = await StudentModel.find();

    const findStudents = findTutor.group.map((item) => {
      return {
        name: item.name,
        faculty: students.filter((c) => c.group.name == item.name)[0].faculty
          .name,
        studentCount: students.filter((c) => c.group.name == item.name).length,
      };
    });

    const compare = await bcrypt.compare(password, findTutor.password);
    if (!compare) {
      return res
        .status(400)
        .json({ status: "error", message: "Password mos kelmadi" });
    }

    const token = generateToken(findTutor._id);
    const { _id, name, role, createdAt, updatedAt } = findTutor;
    const data = {
      _id,
      login: findTutor.login,
      name,
      password: findTutor.password,
      role,
      createdAt,
      updatedAt,
      group: findStudents,
    };
    res.status(200).json({
      status: "success",
      data,
      token,
    });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ status: "error", message: error.message });
  }
});

router.get("/tutor/my-students", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const group = findTutor.group;
    const findStudents = await StudentModel.find().select(
      "group.name faculty.name first_name second_name third_name full_name short_name university image  address  role"
    );
    const groupStudents = group.map((item) => {
      return {
        group: item.name,
        students: findStudents.filter((c) => c.group.name == item.name),
      };
    });

    res.status(201).json({ status: "success", data: groupStudents });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/tutor/change-password", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findTutor = await tutorModel.findById(userId);

    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const { confirmPassword, newPassword } = req.body;

    const comparePassword = await bcrypt.compare(
      confirmPassword,
      findTutor.password
    );
    if (!comparePassword) {
      return res
        .status(401)
        .json({ status: "error", message: "Password togri kelmadi" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const changeTutorData = await tutorModel.findByIdAndUpdate(
      findTutor,
      {
        $set: {
          password: hashedPassword,
        },
      },
      { new: true }
    );

    res.status(201).json({
      status: "success",
      data: changeTutorData,
      message: "Password muaffaqiyatli ozgartirildi!",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});
router.get("/tutor/groups", authMiddleware, async (req, res) => {
  try {
    const findGroups = await StudentModel.find().select("group");
    const uniqueGroups = Array.from(
      new Map(
        findGroups.map((item) => [item.group.name, item.group]) // `group.name` ni key sifatida ishlatamiz
      ).values()
    );

    res.json({ status: "success", data: uniqueGroups });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/tutor/students-group/:group", authMiddleware, async (req, res) => {
  try {
    const { group } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Sahifani son va minimum qiymatlar bilan tekshirish
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, parseInt(limit, 10) || 20);

    const totalCount = await StudentModel.countDocuments({
      "group.name": group,
    }); // Umumiy soni
    const totalPages = Math.ceil(totalCount / limitNumber); // Jami sahifalar

    const findStudents = await StudentModel.find({ "group.name": group })
      .select(
        "group.name faculty.name first_name second_name third_name full_name short_name university image address role"
      )
      .skip((pageNumber - 1) * limitNumber) // Sahifa uchun qoldirish
      .limit(limitNumber); // Limit bo‘yicha natijalarni cheklash

    res.json({
      status: "success",
      page: pageNumber,
      limit: limitNumber,
      totalStudents: totalCount,
      totalPages: totalPages,
      hasNextPage: pageNumber < totalPages, // Keyingi sahifa bormi?
      hasPrevPage: pageNumber > 1, // Oldingi sahifa bormi?
      nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
      prevPage: pageNumber > 1 ? pageNumber - 1 : null,
      data: findStudents,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
