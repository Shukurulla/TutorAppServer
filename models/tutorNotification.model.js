import mongoose from "mongoose";

const tutorNotificationSchema = new mongoose.Schema(
  {
    tutorId: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("tutorNotification", tutorNotificationSchema);
