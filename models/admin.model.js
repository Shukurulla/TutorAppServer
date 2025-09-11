// models/faculty.admin.model.js
import mongoose from "mongoose";

const facultyAdminSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    faculties: [
      {
        name: {
          type: String,
          required: true,
        },
        code: {
          type: String,
          required: true,
        },
      },
    ],
    login: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      // Hash qilinmaydi chunki sizning talabingiz bo'yicha
    },
    image: {
      type: String,
      default:
        "https://static.vecteezy.com/system/resources/thumbnails/024/983/914/small/simple-user-default-icon-free-png.png",
    },
    role: {
      type: String,
      default: "facultyAdmin",
      enum: ["facultyAdmin"],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("facultyAdmin", facultyAdminSchema);
