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
      default: null,
    },
    notification_type: {
      type: String,
      enum: ["report", "push"],
    },
    permission: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const NotificationModel = mongoose.model("notification", notificationSchema);

NotificationModel.collection.createIndex({
  userId: 1,
  notification_type: 1,
  status: 1,
});

export default NotificationModel;
