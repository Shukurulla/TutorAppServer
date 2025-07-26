import mongoose from "mongoose";

const adsSchema = new mongoose.Schema({
  title: {
    type: String,
  },
  image: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
  },
});

export default mongoose.model("ads", adsSchema);
