// models/admin.model.js
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "mainAdmin",
      enum: ["mainAdmin", "facultyAdmin"],
    },
  },
  { timestamps: true }
);

const adminModel = mongoose.model("admin", adminSchema);

export default adminModel;
