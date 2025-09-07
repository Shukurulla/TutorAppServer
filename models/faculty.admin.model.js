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
          type: [Number, String],
          required: true,
        },
      },
    ],
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
      default: "facultyAdmin",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("facultyAdmin", facultyAdminSchema);
