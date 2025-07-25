import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    appartmentId: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
    },
    need_data: {
      type: String,
    },
    notification_type: {
      type: String,
      enum: ["report", "push"],
    },
  },
  {
    timestamps: true,
  }
);

const NotificationModel = mongoose.model("notification", notificationSchema);

export default NotificationModel;
