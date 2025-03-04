import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  first_name: {
    type: String,
  },
  second_name: {
    type: String,
  },
  third_name: {
    type: String,
  },
  full_name: {
    type: String,
  },
  short_name: {
    type: String,
  },
  university: {
    type: String,
  },
  student_id_number: {
    type: String,
  },
  image: {
    type: String,
  },
  birth_date: {
    type: Number,
  },
  email: {
    type: String,
  },
  group: {
    id: {
      type: Number,
    },
    name: {
      type: String,
    },
    educationLang: {
      code: {
        type: String,
      },
      name: {
        type: String,
      },
    },
  },
  faculty: {
    id: {
      type: Number,
    },
    name: {
      type: String,
    },
    code: {
      type: String,
    },
    parent: {
      type: Number,
    },
    active: {
      type: Boolean,
    },
    structureType: {
      code: {
        type: String,
      },
      name: {
        type: String,
      },
    },
    localityType: {
      code: {
        type: String,
      },
      name: {
        type: String,
      },
    },
  },
  educationLang: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  semester: {
    id: {
      type: Number,
    },
    code: {
      type: String,
    },
    name: {
      type: String,
    },
    current: {
      type: Boolean,
    },
    education_year: {
      code: {
        type: String,
      },
      name: {
        type: String,
      },
      current: {
        type: Boolean,
      },
    },
  },
  specialty: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  level: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  educationForm: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  educationType: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  paymentForm: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  studentStatus: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  country: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  district: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  province: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  address: {
    type: String,
  },
  socialCategory: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  accommodation: {
    code: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  validateUrl: {
    type: String,
  },
  hash: {
    type: String,
  },
  gender: {
    type: String,
    default: "",
  },
  role: {
    type: String,
    default: "student",
  },
});

const StudentModel = mongoose.model("student", studentSchema);

export default StudentModel;
