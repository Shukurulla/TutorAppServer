import mongoose from "mongoose";

const filledSchema = new mongoose.Schema(
  {
    filled: {
      type: Boolean,
      required: true,
    },
    studentId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const filledModel = mongoose.model("filled", filledSchema);

export default filledModel;
