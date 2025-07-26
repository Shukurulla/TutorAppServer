import mongoose from "mongoose";
const appartmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
    },
    studentPhoneNumber: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    fullAddress: {
      type: String,
      required: true,
    },
    smallDistrict: {
      type: String,
      required: true,
    },
    typeOfAppartment: {
      type: String,
      required: true,
    },
    contract: {
      type: Boolean,
      required: true,
    },
    typeOfBoiler: {
      type: String,
      required: true,
    },
    priceAppartment: {
      type: Number,
      required: true,
    },
    numberOfStudents: {
      type: Number,
      required: true,
    },
    appartmentOwnerName: {
      type: String,
      required: true,
    },
    appartmentOwnerPhone: {
      type: String,
      required: true,
    },
    appartmentNumber: {
      type: String,
      required: true,
    },
    addition: String,
    current: {
      type: Boolean,
      default: true,
    },
    boilerImage: {
      url: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        default: "Being checked",
      },
    },
    gazStove: {
      url: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        default: "Being checked",
      },
    },
    additionImage: {
      url: {
        type: String,
        default: "",
      },
      status: {
        type: String,
        default: "Being checked",
      },
    },
    chimney: {
      url: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        default: "Being checked",
      },
    },
    status: {
      type: String,
      default: "Being checked",
    },
    needNew: {
      type: Boolean,
      default: false,
    },
    location: {
      lat: {
        type: String,
        required: true,
      },
      long: {
        type: String,
        required: true,
      },
    },
    view: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
    },
    
  },
  { timestamps: true }
);

const AppartmentModel = mongoose.model("appartment", appartmentSchema);

export default AppartmentModel;
