// chat.model.js - yangilangan versiya
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
        // Bir necha guruh uchun array
        id: {
          type: Number,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("chat", ChatSchema);
