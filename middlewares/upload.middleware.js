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
    const prefix = file.mimetype.split("/")[1]; // 'image' yoki 'icon'
    cb(null, `${uniqueSuffix}_${prefix}${fileExt}`);
  },
});

// Fayl filtri
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Faqat JPG, JPEG, PNG va GIF formatlar qabul qilinadi!"));
  }
};

// Upload middleware-lari
export const uploadSingleImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB ga oshirish
    files: 1,
  },
  fileFilter: fileFilter,
}).single("image");

export const uploadMultipleImages = multer({
  storage: imageStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB ga oshirish
    files: 4, // maksimal 4 ta fayl
  },
  fileFilter: fileFilter,
}).fields([
  { name: "boilerImage", maxCount: 1 },
  { name: "gazStove", maxCount: 1 },
  { name: "chimney", maxCount: 1 },
  { name: "additionImage", maxCount: 1 },
]);

export const uploadAdsImages = multer({
  storage: adsStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB ga oshirish
    files: 2,
  },
  fileFilter: fileFilter,
}).fields([
  { name: "image", maxCount: 1 },
  { name: "icon", maxCount: 1 },
]);
// Default export
const upload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter,
});

export default upload;
