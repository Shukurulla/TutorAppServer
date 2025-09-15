import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import tutorModel from "../models/tutor.model.js";
import permissionModel from "../models/permission.model.js";
import NotificationModel from "../models/notification.model.js";
import StudentModel from "../models/student.model.js";
import AppartmentModel from "../models/appartment.model.js";
import moment from "moment";

const router = express.Router();
router.post("/permission-create", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const findTutor = await tutorModel.findById(userId);

    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    await permissionModel.updateMany(
      {
        tutorId: userId,
        status: "process",
      },
      {
        status: "finished",
      }
    );

    // Permission yaratish
    const permission = await permissionModel.create({ tutorId: userId });

    // Har bir guruh uchun notificationlarni yig‘ish
    const allNotifications = await Promise.all(
      findTutor.group.map(async (group) => {
        const students = await StudentModel.find({
          "group.id": `${group.code}`,
        }).select("_id");

        const studentIds = students.map((st) => st._id);

        await NotificationModel.deleteMany({
          notification_type: "report",
          status: "red",
          userId: { $in: studentIds },
          message: "Ijara ma'lumotlarini qayta jo'nating",
        });

        await NotificationModel.deleteMany({
          notification_type: "report",
          status: "blue",
          userId: { $in: studentIds },
        });
        await NotificationModel.deleteMany({
          notification_type: "report",
          status: "yellow",
          userId: { $in: studentIds },
        });

        if (students.length === 0) return [];

        return students.map((student) => ({
          userId: student._id.toString(),
          status: "red",
          notification_type: "report",
          permission: permission._id,
          message: "Ijara ma'lumotlarini qayta jo'nating",
        }));
      })
    );

    // Ichma-ich massivlarni bitta massivga aylantirish
    const notifications = allNotifications.flat();

    // Notificationlarni yaratish
    if (notifications.length > 0) {
      const created = await NotificationModel.insertMany(notifications);
      console.log("✅ Yaralgan notificationlar soni:", created.length);
    } else {
      console.log(
        "⚠️ Hech qanday student topilmadi, notification yaratilmaydi"
      );
    }

    res.status(200).json({ status: "success", data: permission });
  } catch (error) {
    console.error("❌ Permission create error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// GET /my-permissions
router.get("/my-permissions", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const findTutor = await tutorModel.findById(userId).lean();
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    // tutor permissionlarini olish
    const findPermissions = await permissionModel
      .find({ tutorId: userId })
      .select("_id status createdAt")
      .lean();

    if (!findPermissions.length) {
      return res.status(200).json({ status: "success", data: [] });
    }

    // Appartmentlar sonini bitta aggregation bilan olish
    const permissionIds = findPermissions.map((p) => p._id.toString());

    const counts = await AppartmentModel.aggregate([
      { $match: { permission: { $in: permissionIds } } },
      {
        $group: {
          _id: "$permission",
          countDocuments: { $sum: 1 },
        },
      },
    ]);

    // map qilib count ni qo‘shish
    const fullData = findPermissions.map((perm) => {
      const found = counts.find(
        (c) => c._id.toString() === perm._id.toString()
      );
      return {
        _id: perm._id,
        date: perm.createdAt,
        countDocuments: found ? found.countDocuments : 0,
        status: perm.status,
      };
    });

    res.status(200).json({ status: "success", data: fullData });
  } catch (error) {
    console.error("❌ Permissions error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// GET /:permissionId
router.get("/:permissionId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { permissionId } = req.params;

    const findTutor = await tutorModel.findById(userId).lean();
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const permission = await permissionModel.findById(permissionId).lean();
    if (!permission) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday permission topilmadi" });
    }

    // Barcha tutor guruhlari bo‘yicha studentlarni bitta queryda olish
    const groupCodes = findTutor.group.map((g) => g.code);

    const students = await StudentModel.find({
      "group.id": { $in: groupCodes },
    })
      .select("_id group")
      .lean();

    if (!students.length) {
      return res.status(200).json({ status: "success", data: [] });
    }

    // Appartmentlarni aggregation bilan hisoblash
    const studentIds = students.map((s) => s._id.toString());

    const counts = await AppartmentModel.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          permission: permission._id.toString(),
        },
      },
      {
        $group: {
          _id: "$studentId",
          countDocuments: { $sum: 1 },
        },
      },
    ]);

    // har bir guruh bo‘yicha summani olish
    const fullData = findTutor.group.map((g) => {
      const studentInGroup = students
        .filter((s) => s.group.id === g.code)
        .map((s) => s._id.toString());

      const countDocuments = counts
        .filter((c) => studentInGroup.includes(c._id.toString()))
        .reduce((acc, c) => acc + c.countDocuments, 0);

      return {
        groupName: g.name,
        code: g.code,
        countDocuments,
      };
    });

    res.status(200).json({ status: "success", data: fullData });
  } catch (error) {
    console.error("❌ Permission details error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:permissionId/:groupId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { permissionId, groupId } = req.params;

    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    // Guruhdagi studentlarni olish
    const findStudents = await StudentModel.find({
      "group.id": groupId,
    }).select("_id ");

    // Faqat _id larni massivga olish
    const studentIds = findStudents.map((s) => s._id);

    // Appartmentlarni olish
    const findAppartments = await AppartmentModel.find({
      permission: permissionId,
      studentId: { $in: studentIds },
    })
      .select("_id studentId permission status")
      .lean();

    // Har bir appartment uchun student ma'lumotini olish
    const data = await Promise.all(
      findAppartments.map(async (appartment) => {
        const student = await StudentModel.findById(appartment.studentId)
          .select(
            "_id group department gender province level specialty university full_name image short_name second_name first_name third_name"
          )
          .lean();

        return {
          appartment,
          student,
        };
      })
    );

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching appartments:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/special", authMiddleware, async (req, res) => {
  try {
    const { students } = req.body;
    console.log(students);

    for (const st of students) {
      const findRedNotification = await NotificationModel.findOne({
        notification_type: "report",
        status: "red",
        userId: st.studentId, // 🔥 oldin st._id edi, lekin create-da studentId ishlatyapsiz
        permission: st.permissionId,
      });

      await NotificationModel.deleteMany({
        status: "blue",
        notification_type: "report",
        userId: st.studentId,
      });

      if (findRedNotification) {
        return res.status(400).json({
          status: "error",
          message: `Tanlangan studentlar orasida xabarnoma avval yuborilgan lekin hali to‘ldirilmagan`,
        });
      }

      const findAppartment = await AppartmentModel.findOne({
        permission: st.permissionId,
        studentId: st.studentId,
        status: "Being checked",
      });

      if (findAppartment) {
        return res.status(400).json({
          status: "error",
          message: `Iltimos ijara malumotlarini tekshirgan xolda qayta malumot jonatishni talab qiling!!`,
        });
      }

      const findPermission = await permissionModel.findById(st.permissionId);
      if (findPermission.status == "finished") {
        return res.status(400).json({
          status: "error",
          message: "Bu xabarnomaning muddati tugagan",
        });
      }

      await AppartmentModel.deleteOne({ permission: st.permissionId });

      await NotificationModel.deleteOne({
        userId: st.studentId.toString(),
        status: "green",
        notification_type: "report",
      });

      await NotificationModel.create({
        userId: st.studentId.toString(),
        status: "red",
        notification_type: "report",
        permission: st.permissionId,
        message: "Ijara ma'lumotlarini qayta jo'nating",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Tanlangan studentlar uchun xabarnoma jo‘natildi",
    });
  } catch (error) {
    console.error("❌ Error in /special:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/clear", async (req, res) => {
  try {
    await permissionModel.deleteMany();
    res.json({ message: "permissionlar tozalandi" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
