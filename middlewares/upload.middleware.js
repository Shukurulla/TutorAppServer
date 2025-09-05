import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rasm uchun storage
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../public/images");

    // Direktoriyanin mavjudligini tekshirish va yaratish
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Created directory:", uploadDir);
    }

    // Direktoriyang yozish huquqi bor-yo'qligini tekshirish
    try {
      fs.accessSync(uploadDir, fs.constants.W_OK);
      console.log("✅ Directory writable:", uploadDir);
    } catch (error) {
      console.error("❌ Directory not writable:", uploadDir, error);
      return cb(new Error("Upload directory is not writable"));
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    console.log("📎 Processing file:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || "unknown",
    });

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    const filename = `${uniqueSuffix}${fileExt}`;

    console.log("💾 Generated filename:", filename);
    cb(null, filename);
  },
});

// Ads uchun storage
const adsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../public/ads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Created ads directory:", uploadDir);
    }

    try {
      fs.accessSync(uploadDir, fs.constants.W_OK);
      console.log("✅ Ads directory writable:", uploadDir);
    } catch (error) {
      console.error("❌ Ads directory not writable:", uploadDir, error);
      return cb(new Error("Ads upload directory is not writable"));
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    console.log("📎 Processing ads file:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || "unknown",
    });

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    const prefix = file.fieldname; // 'image' yoki 'icon'
    const filename = `${uniqueSuffix}_${prefix}${fileExt}`;

    console.log("💾 Generated ads filename:", filename);
    cb(null, filename);
  },
});

// Fayl filtri - yangilangan
const fileFilter = (req, file, cb) => {
  console.log("🔍 File filter check:", {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
  });

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/bmp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    console.log("✅ File type accepted:", file.mimetype);
    cb(null, true);
  } else {
    console.log("❌ File type rejected:", file.mimetype);
    cb(
      new Error(
        `Fayl turi qabul qilinmaydi: ${file.mimetype}. Faqat JPG, JPEG, PNG, GIF, WEBP va BMP formatlar qabul qilinadi!`
      )
    );
  }
};

// Error handler for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error("🔥 Multer Error:", {
      code: error.code,
      message: error.message,
      field: error.field,
      limit: error.limit,
    });

    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(413).json({
          status: "error",
          message: "Fayl hajmi juda katta",
          details: `Maksimal hajm: ${Math.round(
            error.limit / (1024 * 1024)
          )} MB`,
          code: error.code,
        });

      case "LIMIT_FILE_COUNT":
        return res.status(413).json({
          status: "error",
          message: "Juda ko'p fayl yuklandi",
          details: `Maksimal: ${error.limit} ta fayl`,
          code: error.code,
        });

      case "LIMIT_FIELD_KEY":
        return res.status(413).json({
          status: "error",
          message: "Field nomi juda uzun",
          code: error.code,
        });

      case "LIMIT_FIELD_VALUE":
        return res.status(413).json({
          status: "error",
          message: "Field qiymati juda katta",
          code: error.code,
        });

      case "LIMIT_FIELD_COUNT":
        return res.status(413).json({
          status: "error",
          message: "Juda ko'p field",
          code: error.code,
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(413).json({
          status: "error",
          message: "Kutilmagan fayl",
          field: error.field,
          code: error.code,
        });

      default:
        return res.status(400).json({
          status: "error",
          message: "Fayl yuklashda xatolik",
          details: error.message,
          code: error.code,
        });
    }
  }

  if (error.message.includes("not writable")) {
    return res.status(500).json({
      status: "error",
      message: "Server fayl yozish huquqiga ega emas",
      details: error.message,
    });
  }

  if (error.message.includes("Fayl turi qabul qilinmaydi")) {
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }

  next(error);
};

// Upload middleware-lari - yangilangan limitlar bilan
export const uploadSingleImage = (req, res, next) => {
  const upload = multer({
    storage: imageStorage,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB
      files: 1,
      fields: 10,
      fieldSize: 10 * 1024 * 1024, // 10MB per field
      fieldNameSize: 100,
    },
    fileFilter: fileFilter,
  }).single("image");

  upload(req, res, (error) => {
    if (error) {
      return handleMulterError(error, req, res, next);
    }

    if (req.file) {
      console.log("✅ Single image uploaded successfully:", {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    }

    next();
  });
};

export const uploadMultipleImages = (req, res, next) => {
  const upload = multer({
    storage: imageStorage,
    limits: {
      fileSize: 500 * 1024 * 1024, // Har bir fayl uchun 500MB
      files: 4, // Maksimal 4 ta fayl
      fields: 20,
      fieldSize: 10 * 1024 * 1024, // 10MB per field
      fieldNameSize: 100,
    },
    fileFilter: fileFilter,
  }).fields([
    { name: "boilerImage", maxCount: 1 },
    { name: "gazStove", maxCount: 1 },
    { name: "chimney", maxCount: 1 },
    { name: "additionImage", maxCount: 1 },
  ]);

  upload(req, res, (error) => {
    if (error) {
      return handleMulterError(error, req, res, next);
    }

    if (req.files) {
      console.log("✅ Multiple images uploaded successfully:", {
        files: Object.keys(req.files),
        total: Object.values(req.files).reduce(
          (sum, files) => sum + files.length,
          0
        ),
      });

      // Har bir faylni log qilish
      Object.entries(req.files).forEach(([fieldName, files]) => {
        files.forEach((file) => {
          console.log(`📎 ${fieldName}:`, {
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
          });
        });
      });
    }

    next();
  });
};

export const uploadAdsImages = (req, res, next) => {
  const upload = multer({
    storage: adsStorage,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB
      files: 2, // image va icon
      fields: 10,
      fieldSize: 10 * 1024 * 1024, // 10MB per field
      fieldNameSize: 100,
    },
    fileFilter: fileFilter,
  }).fields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]);

  upload(req, res, (error) => {
    if (error) {
      return handleMulterError(error, req, res, next);
    }

    if (req.files) {
      console.log("✅ Ads images uploaded successfully:", {
        files: Object.keys(req.files),
        total: Object.values(req.files).reduce(
          (sum, files) => sum + files.length,
          0
        ),
      });
    }

    next();
  });
};

// Default export
const upload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
    files: 1,
    fields: 10,
    fieldSize: 10 * 1024 * 1024,
    fieldNameSize: 100,
  },
  fileFilter: fileFilter,
});

export default upload;
