import express from "express";
import adsModel from "../models/ads.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  uploadAdsImages,
  uploadSingleImage,
} from "../middlewares/upload.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// CREATE - Yangi ads yaratish
router.post(
  "/ads/create",
  authMiddleware,
  uploadAdsImages,
  async (req, res) => {
    try {
      const { title } = req.body;

      // Title tekshirish
      if (!title) {
        return res.status(400).json({
          status: "error",
          message: "Title majburiy",
        });
      }

      // Kamida image fayli majburiy
      if (!req.files || !req.files.image) {
        return res.status(400).json({
          status: "error",
          message: "Image fayl majburiy",
        });
      }

      const imageFile = req.files.image[0];
      const iconFile = req.files.icon ? req.files.icon[0] : null;

      const newAd = new adsModel({
        title,
        image: `/public/ads/${imageFile.filename}`,
        icon: iconFile ? `/public/ads/${iconFile.filename}` : "",
      });

      await newAd.save();

      res.status(201).json({
        status: "success",
        message: "Reklama muvaffaqiyatli yaratildi",
        data: newAd,
      });
    } catch (error) {
      console.error("Ads yaratishda xatolik:", error);
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
);

// GET ALL - Barcha ads larni olish
router.get("/ads/all", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, parseInt(limit, 10) || 10);

    const totalCount = await adsModel.countDocuments();
    const totalPages = Math.ceil(totalCount / limitNumber);

    const ads = await adsModel
      .find()
      .sort({ createdAt: -1 }) // Eng yangilarini birinchi
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    res.status(200).json({
      status: "success",
      data: ads,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// GET BY ID - Bitta ads ni olish
router.get("/ads/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await adsModel.findById(id);
    if (!ad) {
      return res.status(404).json({
        status: "error",
        message: "Bunday reklama topilmadi",
      });
    }

    res.status(200).json({
      status: "success",
      data: ad,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// UPDATE - Ads ni yangilash
router.put("/ads/:id", authMiddleware, uploadAdsImages, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    // Ads mavjudligini tekshirish
    const existingAd = await adsModel.findById(id);
    if (!existingAd) {
      return res.status(404).json({
        status: "error",
        message: "Bunday reklama topilmadi",
      });
    }

    // Yangilash uchun ma'lumotlar
    const updateData = {};
    if (title) updateData.title = title;

    // Yangi fayllar yuklangan bo'lsa
    if (req.files) {
      // Image yangilash
      if (req.files.image && req.files.image[0]) {
        // Eski image ni o'chirish
        if (existingAd.image) {
          const oldImagePath = path.join(__dirname, "..", existingAd.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        updateData.image = `/public/ads/${req.files.image[0].filename}`;
      }

      // Icon yangilash
      if (req.files.icon && req.files.icon[0]) {
        // Eski icon ni o'chirish
        if (existingAd.icon) {
          const oldIconPath = path.join(__dirname, "..", existingAd.icon);
          if (fs.existsSync(oldIconPath)) {
            fs.unlinkSync(oldIconPath);
          }
        }
        updateData.icon = `/public/ads/${req.files.icon[0].filename}`;
      }
    }

    // Ma'lumotlarni yangilash
    const updatedAd = await adsModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    res.status(200).json({
      status: "success",
      message: "Reklama muvaffaqiyatli yangilandi",
      data: updatedAd,
    });
  } catch (error) {
    console.error("Ads yangilashda xatolik:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// DELETE - Ads ni o'chirish
router.delete("/ads/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Ads mavjudligini tekshirish
    const existingAd = await adsModel.findById(id);
    if (!existingAd) {
      return res.status(404).json({
        status: "error",
        message: "Bunday reklama topilmadi",
      });
    }

    // Fayllarni o'chirish
    if (existingAd.image) {
      const imagePath = path.join(__dirname, "..", existingAd.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    if (existingAd.icon) {
      const iconPath = path.join(__dirname, "..", existingAd.icon);
      if (fs.existsSync(iconPath)) {
        fs.unlinkSync(iconPath);
      }
    }

    // Ma'lumotlar bazasidan o'chirish
    await adsModel.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Reklama muvaffaqiyatli o'chirildi",
    });
  } catch (error) {
    console.error("Ads o'chirishda xatolik:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// SEARCH - Title bo'yicha qidirish
router.get("/ads/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, parseInt(limit, 10) || 10);

    // RegExp orqali qidirish (case insensitive)
    const searchRegex = new RegExp(query, "i");

    const totalCount = await adsModel.countDocuments({
      title: { $regex: searchRegex },
    });
    const totalPages = Math.ceil(totalCount / limitNumber);

    const ads = await adsModel
      .find({
        title: { $regex: searchRegex },
      })
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    res.status(200).json({
      status: "success",
      data: ads,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        limit: limitNumber,
        searchQuery: query,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// BULK DELETE - Bir nechta ads larni o'chirish
router.delete("/ads/bulk-delete", authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body; // Array of IDs

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "IDs massiv bo'lishi va bo'sh bo'lmasligi kerak",
      });
    }

    // Ads larni topish va fayllarni o'chirish
    const adsToDelete = await adsModel.find({ _id: { $in: ids } });

    for (const ad of adsToDelete) {
      // Image faylini o'chirish
      if (ad.image) {
        const imagePath = path.join(__dirname, "..", ad.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      // Icon faylini o'chirish
      if (ad.icon) {
        const iconPath = path.join(__dirname, "..", ad.icon);
        if (fs.existsSync(iconPath)) {
          fs.unlinkSync(iconPath);
        }
      }
    }

    // Ma'lumotlar bazasidan o'chirish
    const deleteResult = await adsModel.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      status: "success",
      message: `${deleteResult.deletedCount} ta reklama muvaffaqiyatli o'chirildi`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Bulk delete xatolik:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// UPDATE STATUS - Agar kerak bo'lsa status field qo'shish uchun
router.patch("/ads/:id/status", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // active, inactive, pending

    const validStatuses = ["active", "inactive", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message:
          "Status faqat 'active', 'inactive' yoki 'pending' bo'lishi mumkin",
      });
    }

    const updatedAd = await adsModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );

    if (!updatedAd) {
      return res.status(404).json({
        status: "error",
        message: "Bunday reklama topilmadi",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Status muvaffaqiyatli yangilandi",
      data: updatedAd,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

export default router;
