// chat.routes.js - to'liq yangilangan versiya
import express from "express";
import chatModel from "../models/chat.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";
import StudentModel from "../models/student.model.js";

const router = express.Router();

// Barcha xabarlarni olish (admin uchun)
router.get("/messages/all", authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { [sortBy]: order === "asc" ? 1 : -1 },
    };

    const messages = await chatModel
      .find()
      .populate("tutorId", "name email")
      .sort(options.sort)
      .limit(options.limit)
      .skip(options.skip);

    const total = await chatModel.countDocuments();

    res.status(200).json({
      status: "success",
      data: messages,
      pagination: {
        total,
        pages: Math.ceil(total / options.limit),
        currentPage: parseInt(page),
        perPage: options.limit,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Tutor o'z xabarlarini olish
router.get("/messages/tutor/:tutorId", authMiddleware, async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { page = 1, limit = 50, targetType } = req.query;

    const findTutor = await tutorModel.findById(tutorId);
    if (!findTutor) {
      return res.status(404).json({
        status: "error",
        message: "Tutor topilmadi",
      });
    }

    let query = { tutorId };

    // Filter by target type if specified
    if (targetType === "groups") {
      query["groups.0"] = { $exists: true };
    } else if (targetType === "students") {
      query["students.0"] = { $exists: true };
    }

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 },
    };

    const messages = await chatModel
      .find(query)
      .sort(options.sort)
      .limit(options.limit)
      .skip(options.skip);

    const total = await chatModel.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: messages,
      tutor: {
        id: findTutor._id,
        name: findTutor.name,
        groups: findTutor.group,
      },
      pagination: {
        total,
        pages: Math.ceil(total / options.limit),
        currentPage: parseInt(page),
        perPage: options.limit,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Ma'lum guruh uchun xabarlarni olish
router.get("/messages/group/:groupId", authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 },
    };

    const messages = await chatModel
      .find({
        "groups.id": parseInt(groupId),
      })
      .populate("tutorId", "name email")
      .sort(options.sort)
      .limit(options.limit)
      .skip(options.skip);

    const total = await chatModel.countDocuments({
      "groups.id": parseInt(groupId),
    });

    res.status(200).json({
      status: "success",
      groupId: parseInt(groupId),
      data: messages,
      pagination: {
        total,
        pages: Math.ceil(total / options.limit),
        currentPage: parseInt(page),
        perPage: options.limit,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Student uchun xabarlarni olish (shaxsiy + guruh xabarlari)
router.get("/messages/student/:studentId", authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 50, type = "all" } = req.query;

    // Student ma'lumotlarini olish
    const student = await StudentModel.findOne({ id: studentId });
    if (!student) {
      return res.status(404).json({
        status: "error",
        message: "Student topilmadi",
      });
    }

    let query;

    if (type === "personal") {
      // Faqat shaxsiy xabarlar
      query = { "students.id": studentId };
    } else if (type === "group") {
      // Faqat guruh xabarlari
      query = student.group ? { "groups.id": student.group } : { _id: null };
    } else {
      // Barcha xabarlar (shaxsiy + guruh)
      query = {
        $or: [
          { "students.id": studentId },
          student.group ? { "groups.id": student.group } : { _id: null },
        ],
      };
    }

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 },
    };

    const messages = await chatModel
      .find(query)
      .populate("tutorId", "name email")
      .sort(options.sort)
      .limit(options.limit)
      .skip(options.skip);

    const total = await chatModel.countDocuments(query);

    // Xabarlarni turlarga ajratish
    const categorizedMessages = messages.map((msg) => ({
      ...msg.toObject(),
      isPersonal: msg.students.some((s) => s.id === studentId),
      isGroup: msg.groups.some((g) => g.id === student.group),
    }));

    res.status(200).json({
      status: "success",
      student: {
        id: student.id,
        name: student.name,
        group: student.group,
      },
      data: categorizedMessages,
      pagination: {
        total,
        pages: Math.ceil(total / options.limit),
        currentPage: parseInt(page),
        perPage: options.limit,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Yangi xabar yaratish (API orqali)
router.post("/messages/create", authMiddleware, async (req, res) => {
  try {
    const { tutorId, message, targetType, targets } = req.body;

    // Validatsiya
    if (!tutorId || !message) {
      return res.status(400).json({
        status: "error",
        message: "TutorId va message majburiy",
      });
    }

    const tutor = await tutorModel.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({
        status: "error",
        message: "Tutor topilmadi",
      });
    }

    let messageData = {
      tutorId,
      message,
      groups: [],
      students: [],
    };

    // Maqsadli auditoriyaga qarab ma'lumotlarni to'ldirish
    if (targetType === "groups" && targets && targets.length > 0) {
      messageData.groups = targets.map((groupId) => {
        const group = tutor.group.find((g) => g.code === parseInt(groupId));
        return {
          id: parseInt(groupId),
          name: group ? group.name : `Group ${groupId}`,
        };
      });
    } else if (targetType === "students" && targets && targets.length > 0) {
      // Studentlar mavjudligini tekshirish
      const studentIds = targets;
      const existingStudents = await StudentModel.find({
        id: { $in: studentIds },
      });

      if (existingStudents.length !== studentIds.length) {
        return res.status(400).json({
          status: "error",
          message: "Ba'zi studentlar topilmadi",
        });
      }

      messageData.students = studentIds.map((id) => ({ id }));
    } else if (targetType === "all") {
      messageData.groups = tutor.group.map((group) => ({
        id: group.code,
        name: group.name,
      }));
    } else {
      return res.status(400).json({
        status: "error",
        message: "targetType va targets parametrlari noto'g'ri",
      });
    }

    const newMessage = await chatModel.create(messageData);

    // Socket orqali real-time yuborish
    const io = req.app.get("io");
    if (io) {
      if (messageData.groups.length > 0) {
        messageData.groups.forEach((group) => {
          io.to(`group_${group.id}`).emit("receiveMessage", {
            ...newMessage.toObject(),
            tutorName: tutor.name,
          });
        });
      }

      if (messageData.students.length > 0) {
        messageData.students.forEach((student) => {
          io.to(`student_${student.id}`).emit("receiveMessage", {
            ...newMessage.toObject(),
            tutorName: tutor.name,
          });
        });
      }
    }

    res.status(201).json({
      status: "success",
      message: "Xabar muvaffaqiyatli yaratildi",
      data: newMessage,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Xabarni o'chirish
router.delete(
  "/messages/delete/:messageId",
  authMiddleware,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { tutorId } = req.body;

      const message = await chatModel.findOne({ _id: messageId, tutorId });

      if (!message) {
        return res.status(404).json({
          status: "error",
          message: "Xabar topilmadi yoki sizga tegishli emas",
        });
      }

      await chatModel.findByIdAndDelete(messageId);

      // Socket orqali real-time o'chirish
      const io = req.app.get("io");
      if (io) {
        if (message.groups && message.groups.length > 0) {
          message.groups.forEach((group) => {
            io.to(`group_${group.id}`).emit("messageDeleted", { messageId });
          });
        }

        if (message.students && message.students.length > 0) {
          message.students.forEach((student) => {
            io.to(`student_${student.id}`).emit("messageDeleted", {
              messageId,
            });
          });
        }
      }

      res.status(200).json({
        status: "success",
        message: "Xabar muvaffaqiyatli o'chirildi",
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

// Tutorning barcha xabarlarini o'chirish
router.delete(
  "/messages/delete-all/:tutorId",
  authMiddleware,
  async (req, res) => {
    try {
      const { tutorId } = req.params;

      const result = await chatModel.deleteMany({ tutorId });

      res.status(200).json({
        status: "success",
        message: `${result.deletedCount} ta xabar o'chirildi`,
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

// Xabarni tahrirlash
router.put("/messages/edit/:messageId", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message, tutorId } = req.body;

    if (!message) {
      return res.status(400).json({
        status: "error",
        message: "Yangi xabar matni kiritilmagan",
      });
    }

    const editMessage = await chatModel.findOneAndUpdate(
      { _id: messageId, tutorId },
      { message },
      { new: true }
    );

    if (!editMessage) {
      return res.status(404).json({
        status: "error",
        message: "Xabar topilmadi yoki sizga tegishli emas",
      });
    }

    // Socket orqali real-time yangilash
    const io = req.app.get("io");
    if (io) {
      const updateData = {
        messageId,
        newMessage: message,
        updatedAt: editMessage.updatedAt,
      };

      if (editMessage.groups && editMessage.groups.length > 0) {
        editMessage.groups.forEach((group) => {
          io.to(`group_${group.id}`).emit("messageEdited", updateData);
        });
      }

      if (editMessage.students && editMessage.students.length > 0) {
        editMessage.students.forEach((student) => {
          io.to(`student_${student.id}`).emit("messageEdited", updateData);
        });
      }
    }

    res.status(200).json({
      status: "success",
      message: "Xabar muvaffaqiyatli tahrirlandi",
      data: editMessage,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Statistika - tutor uchun
router.get("/messages/stats/:tutorId", authMiddleware, async (req, res) => {
  try {
    const { tutorId } = req.params;

    const totalMessages = await chatModel.countDocuments({ tutorId });
    const groupMessages = await chatModel.countDocuments({
      tutorId,
      "groups.0": { $exists: true },
    });
    const personalMessages = await chatModel.countDocuments({
      tutorId,
      "students.0": { $exists: true },
    });

    // Oxirgi 7 kunlik statistika
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const weeklyMessages = await chatModel.countDocuments({
      tutorId,
      createdAt: { $gte: lastWeek },
    });

    res.status(200).json({
      status: "success",
      stats: {
        total: totalMessages,
        groupMessages,
        personalMessages,
        weeklyMessages,
        avgPerDay: (weeklyMessages / 7).toFixed(1),
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
