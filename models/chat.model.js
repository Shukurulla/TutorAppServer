import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    groups: [
      {
        id: {
          type: Number,
          default: null,
        },
        name: {
          type: String,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("chat", ChatSchema);
