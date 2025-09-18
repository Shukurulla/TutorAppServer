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
          // required: true,
          default: null,
        },
        name: {
          type: String,
          // required: true,
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
