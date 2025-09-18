// chat.routes.js - yangilangan versiya
import express from "express";
import chatModel from "../models/chat.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";

const router = express.Router();

router.get("/messages/all", authMiddleware, async (req, res) => {
  try {
    const findAllMessages = await chatModel.find();
    res.status(200).json({ status: "success", data: findAllMessages });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/messages/my-messages/:id", authMiddleware, async (req, res) => {
  try {
    const findTutor = await tutorModel.findById(req.params.id);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "bunday tutor topilmadi" });
    }

    // Endi har bir xabar unique bo'ladi
    const messages = await chatModel.find({ tutorId: req.params.id });

    res.status(200).json({ status: "success", data: messages });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/messages/by-group/:id", authMiddleware, async (req, res) => {
  try {
    // Specific guruh uchun xabarlarni topish
    const findMessages = await chatModel
      .find({
        "groups.id": parseInt(req.params.id),
      })
      .select("-groups");
    res.json({ status: "success", data: findMessages });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete(
  "/messages/delete-all/:tutorId",
  authMiddleware,
  async (req, res) => {
    try {
      await chatModel.deleteMany({ tutorId: req.params.tutorId });
      res.status(200).json({
        status: "success",
        message: "Messagelar muaffaqiyatli ochirildi",
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

router.put("/messages/edit-message", authMiddleware, async (req, res) => {
  try {
    const { message, messageId } = req.body;

    if (!message) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos malumotlarni toliq kiriting",
      });
    }

    const editMessage = await chatModel.findByIdAndUpdate(
      messageId,
      { message },
      { new: true }
    );

    if (!editMessage) {
      return res.status(400).json({
        status: "error",
        message: "Bunday message topilmadi",
      });
    }

    res.status(200).json({ status: "success", data: editMessage });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
