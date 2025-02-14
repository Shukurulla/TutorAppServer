import mongoose from "mongoose";

const tutorSchema = new mongoose.Schema(
  {
    login: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "tutor",
    },
    faculty: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const tutorModel = mongoose.model("tutor", tutorSchema);

export default tutorModel;
