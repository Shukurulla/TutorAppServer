import express from "express";
import filledModel from "../models/filled.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import StudentModel from "../models/student.model.js";

const router = express.Router();

router.post("/filled", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { filled } = req.body;
    const findStudent = await StudentModel.findById(userId);
    if (!findStudent) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday student topilmadi" });
    }

    const findFilled = await filledModel.findOne({ studentId: userId });
    if (findFilled) {
      return res
        .status(400)
        .json({ status: "error", message: "siz oldin filled qoshgansiz" });
    }

    const createFilled = await filledModel.create({
      studentId: findStudent._id,
      filled,
    });
    res.status(200).json({ status: "success", filled: createFilled });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/filled", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findStudent = await StudentModel.findById(userId);
    if (!findStudent) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday student topilmadi" });
    }

    const findFilled = await filledModel.findOne({ studentId: userId });
    if (!findFilled) {
      return res
        .status(400)
        .json({ status: "error", message: "Sizda filled mavjud emas" });
    }
    res.status(200).json({ status: "success", filled: findFilled });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});
router.put("/filled", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { filled } = req.body;
    const findStudent = await StudentModel.findById(userId);
    if (!findStudent) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday student topilmadi" });
    }

    const findFilled = await filledModel.findOne({ studentId: userId });
    if (!findFilled) {
      return res
        .status(400)
        .json({ status: "error", message: "Sizda filled mavjud emas" });
    }

    const editFilled = await filledModel.findByIdAndUpdate(
      findFilled._id,
      {
        $set: {
          filled,
        },
      },
      { new: true }
    );
    res.status(200).json({ status: "success", filled: editFilled });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});
router.delete("/filled", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { filled } = req.body;
    const findStudent = await StudentModel.findById(userId);
    if (!findStudent) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday student topilmadi" });
    }

    const findFilled = await filledModel.findOne({ studentId: userId });
    if (!findFilled) {
      return res
        .status(400)
        .json({ status: "error", message: "Sizda filled mavjud emas" });
    }

    await filledModel.findByIdAndDelete(findFilled._id);
    res.status(200).json({ status: "success", filled: findFilled });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
