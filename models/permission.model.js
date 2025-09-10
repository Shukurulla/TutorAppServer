import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    forStudents: {
      type: [
        {
          studentId: {
            type: String,
          },
        },
      ],
    },
    for: {
      type: String,
      default: "all",
    },
    status: {
      type: String,
      enum: ["process", "finished"],
      default: "process",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("permission", permissionSchema);
