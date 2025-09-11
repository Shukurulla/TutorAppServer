// models/admin.model.js - Tuzatilgan versiya
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "mainAdmin",
      enum: ["mainAdmin"],
    },
    image: {
      type: String,
      default:
        "https://static.vecteezy.com/system/resources/thumbnails/024/983/914/small/simple-user-default-icon-free-png.png",
    },
  },
  {
    timestamps: true,
  }
);

// Model mavjudligini tekshirish va export qilish
let adminModel;

try {
  // Agar model allaqachon mavjud bo'lsa, uni olish
  adminModel = mongoose.model("admin");
} catch (error) {
  // Agar model mavjud bo'lmasa, yangi yaratish
  adminModel = mongoose.model("admin", adminSchema);
}

export default adminModel;
