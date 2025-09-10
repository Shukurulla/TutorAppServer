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

    // Permission yaratish
    const permission = await permissionModel.create({ tutorId: userId });

    // Har bir guruh uchun notificationlarni yig‘ish
    const allNotifications = await Promise.all(
      findTutor.group.map(async (group) => {
        const students = await StudentModel.find({
          "group.id": `${group.code}`,
        }).select("_id");

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

router.get("/my-permissions", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const findTutor = await tutorModel.findById(userId);

    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    // tutor permissionlarini olish
    const findPermissions = await permissionModel
      .find({ tutorId: userId })
      .select("_id status createdAt");

    // har bir permission uchun Appartmentlarni yig‘ish
    const fullData = await Promise.all(
      findPermissions.map(async (perm) => {
        const findAppartment = await AppartmentModel.countDocuments({
          permission: perm._id.toString(),
        });

        return {
          _id: perm._id,
          date: moment(perm.createdAt).format("DD.MM.YYYY"),
          countDocuments: findAppartment, // nechta hujjat
          status: perm.status,
        };
      })
    );

    res.status(200).json({ status: "success", data: fullData });
  } catch (error) {
    console.error("❌ Permissions error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:permissionId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const { permissionId } = req.params;

    const findTutor = await tutorModel.findById(userId);
    if (!findTutor) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday tutor topilmadi" });
    }

    const permission = await permissionModel.findById(permissionId);
    if (!permission) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday permission topilmadi" });
    }

    // map ichidagi async funksiyalarni await bilan ishlatish
    const fullData = await Promise.all(
      findTutor.group.map(async (gr) => {
        // Guruhdagi studentlarni olish
        const findStudents = await StudentModel.find({
          "group.id": `${gr.code}`,
        }).select("_id");

        // Student _id larini massivga olish
        const studentIds = findStudents.map((s) => `${s._id}`);

        // Appartmentlar sonini hisoblash
        const countStudents = await AppartmentModel.countDocuments({
          studentId: { $in: studentIds },
          permission: permission._id.toString(),
        });

        return {
          groupName: gr.name,
          code: gr.code,
          countDocuments: countStudents,
        };
      })
    );

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
    }).select("_id");

    // Faqat _id larni massivga olish
    const studentIds = findStudents.map((s) => s._id);

    // Appartmentlarni olish
    const findAppartments = await AppartmentModel.find({
      permission: permissionId,
      studentId: { $in: studentIds },
    });

    res.status(200).json({ status: "success", data: findAppartments });
  } catch (error) {
    console.error("❌ Error fetching appartments:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
