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
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${fileExt}`);
  },
});

// Files uchun storage (PDF va boshqa hujjatlar uchun)
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../public/files");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${fileExt}`);
  },
});

// Ads uchun storage
const adsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../public/ads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    const prefix = file.mimetype.split("/")[0]; // 'image'
    cb(null, `${uniqueSuffix}_${prefix}${fileExt}`);
  },
});

// Rasm fayl filtri
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Faqat JPG, JPEG, PNG va GIF formatlar qabul qilinadi!"));
  }
};

// PDF va hujjat fayl filtri
const documentFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Faqat PDF, JPG, JPEG, PNG va GIF formatlar qabul qilinadi!"));
  }
};

// Universal fayl filtri (barcha fayl turlari uchun)
const universalFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Faqat PDF, JPG, JPEG, PNG va GIF formatlar qabul qilinadi!"));
  }
};

// Upload limitlari
const uploadLimits = {
  fileSize: 100 * 1024 * 1024, // 100MB
  files: 10,
  fields: 20,
  fieldNameSize: 200,
  fieldSize: 1024 * 1024, // 1MB
};

// Upload middleware-lari
export const uploadSingleImage = multer({
  storage: imageStorage,
  limits: uploadLimits,
  fileFilter: imageFileFilter,
}).single("image");

export const uploadMultipleImages = multer({
  storage: imageStorage,
  limits: uploadLimits,
  fileFilter: imageFileFilter,
}).fields([
  { name: "boilerImage", maxCount: 1 },
  { name: "gazStove", maxCount: 1 },
  { name: "chimney", maxCount: 1 },
  { name: "additionImage", maxCount: 1 },
]);

// Custom storage for mixed file types
const mixedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      const uploadDir = path.join(__dirname, "../public/files");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } else {
      const uploadDir = path.join(__dirname, "../public/images");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${fileExt}`);
  },
});

// YANGI: Appartment uchun rasm va PDF fayllarni yuklash
export const uploadAppartmentFiles = multer({
  storage: mixedStorage,
  limits: uploadLimits,
  fileFilter: universalFileFilter,
}).fields([
  { name: "boilerImage", maxCount: 1 },
  { name: "gazStove", maxCount: 1 },
  { name: "chimney", maxCount: 1 },
  { name: "additionImage", maxCount: 1 },
  { name: "contractImage", maxCount: 1 }, // Yangi
  { name: "contractPdf", maxCount: 1 }, // Yangi
]);

export const uploadAdsImages = multer({
  storage: adsStorage,
  limits: uploadLimits,
  fileFilter: imageFileFilter,
}).fields([
  { name: "image", maxCount: 1 },
  { name: "icon", maxCount: 1 },
]);

// Contract fayllari uchun alohida middleware
export const uploadContractFiles = multer({
  storage: mixedStorage,
  limits: uploadLimits,
  fileFilter: universalFileFilter,
}).fields([
  { name: "contractImage", maxCount: 1 },
  { name: "contractPdf", maxCount: 1 },
]);

// Default export
const upload = multer({
  storage: imageStorage,
  limits: uploadLimits,
  fileFilter: imageFileFilter,
});

export default upload;
