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
    isRead: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const NotificationModel = mongoose.model("notification", notificationSchema);

export default NotificationModel;
