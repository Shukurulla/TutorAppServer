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

// chat.routes.js - yangilangan versiya
router.get("/messages/my-messages/:id", authMiddleware, async (req, res) => {
  try {
    const findTutor = await tutorModel.findById(req.params.id);
    if (!findTutor) {
      return res
        .status(401)
        .json({ status: "error", message: "bunday tutor topilmadi" });
    }

    // Barcha xabarlarni olamiz
    const allMessages = await chatModel.find({ tutorId: req.params.id });
    
    // Unique xabarlarni map orqali guruhlash
    const uniqueMessages = new Map();
    
    allMessages.forEach(message => {
      const key = `${message.message}_${message.createdAt.getTime()}`;
      if (!uniqueMessages.has(key)) {
        uniqueMessages.set(key, {
          _id: message._id,
          tutorId: message.tutorId,
          message: message.message,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          __v: message.__v,
          groups: [message.group] // Birinchi guruhni qo'shamiz
        });
      } else {
        // Agar xabar mavjud bo'lsa, faqat guruhni qo'shamiz
        uniqueMessages.get(key).groups.push(message.group);
      }
    });

    const messages = Array.from(uniqueMessages.values());
    res.status(200).json({ status: "success", data: messages });
    
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/messages/by-group/:id", authMiddleware, async (req, res) => {
  try {
    const findMessages = await chatModel.find({ "group.id": req.params.id });
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
      const findMessages = await chatModel.find({
        tutorId: req.params.tutorId,
      });
      for (let i = 0; i < findMessages.length; i++) {
        await chatModel.findByIdAndDelete(findMessages[i]._id);
      }
      res
        .status(200)
        .json({
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
    const findMessage = await chatModel.findById(messageId);
    if (!findMessage) {
      return res.status(400).json({
        status: "error",
        message: "Bunday message topilmadi",
      });
    }
    const editMessage = await chatModel.findById(
      messageId,
      { message },
      { new: true }
    );
    res.status(200).json({ status: "success", data: editMessage });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});
export default router;
