import express from "express";
import chatModel from "../models/chat.model";
import authMiddleware from "../middlewares/auth.middleware";
import tutorModel from "../models/tutor.model";

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

    const messages = await chatModel.find({ tutorId: req.params.id });

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

router.delete("/messages/delete/:id", authMiddleware, async (req, res) => {
  try {
    const findMessage = await chatModel.findById(req.params.id);
    if (!findMessage) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday message topilmadi" });
    }
    await chatModel.findByIdAndDelete(findMessage._id);
    res
      .status(200)
      .json({ status: "success", message: "Message muaffaqiyatli ochirildi" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete("/messages/edit-message", authMiddleware, async (req, res) => {
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
