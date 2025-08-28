import mongoose from "mongoose";

const tutorNotificationSchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
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
    type: {
      type: String,
      enum: ["group_added", "group_removed", "system", "announcement"],
      default: "system",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const tutorNotificationModel = mongoose.model(
  "TutorNotification",
  tutorNotificationSchema
);

export default tutorNotificationModel;
