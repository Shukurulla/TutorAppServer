// utils/fixStudentData.js
import StudentModel from "../models/student.model.js";
import mongoose from "mongoose";

export const fixExistingStudentData = async () => {
  try {
    console.log("🔧 Starting student data fix...");

    const students = await StudentModel.find({}).lean();
    console.log(`Found ${students.length} students to check`);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];

      try {
        const updateData = {};
        let needsUpdate = false;

        // Specialty ID ni tekshirish va tuzatish
        if (
          student.specialty &&
          typeof student.specialty.id === "string" &&
          student.specialty.id.includes("-")
        ) {
          updateData["specialty.id"] = student.specialty.id; // String sifatida qoldirish
          needsUpdate = true;
        }

        // Group ID ni tekshirish
        if (
          student.group &&
          typeof student.group.id === "string" &&
          student.group.id.includes("-")
        ) {
          updateData["group.id"] = student.group.id;
          needsUpdate = true;
        }

        // Department ID ni tekshirish
        if (
          student.department &&
          typeof student.department.id === "string" &&
          student.department.id.includes("-")
        ) {
          updateData["department.id"] = student.department.id;
          needsUpdate = true;
        }

        // Semester ID ni tekshirish
        if (
          student.semester &&
          typeof student.semester.id === "string" &&
          student.semester.id.includes("-")
        ) {
          updateData["semester.id"] = student.semester.id;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await StudentModel.updateOne(
            { _id: student._id },
            { $set: updateData },
            { runValidators: false }
          );
          console.log(
            `✅ Fixed student ${i + 1}/${students.length}: ${
              student.student_id_number
            }`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error fixing student ${student.student_id_number}:`,
          error.message
        );
      }
    }

    console.log("🎉 Student data fix completed!");
  } catch (error) {
    console.error("❌ Error in fixExistingStudentData:", error);
  }
};
