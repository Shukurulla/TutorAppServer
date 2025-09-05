import axios from "axios";
import StudentModel from "../models/student.model.js";
// Delay funksiyasi (timeout uchun)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Barcha studentlarni yuklab olish funksiyasi

export async function fetchAllStudents() {
  try {
    const token = "Bearer erkFR_9u2IOFoaGxYQPDmjmXVe6Oqv3s";

    // Avval 1-betni olib, umumiy sahifalar sonini bilib olamiz
    const firstResponse = await axios.get(
      "https://student.karsu.uz/rest/v1/data/student-list?limit=200",
      {
        headers: { Authorization: token },
      }
    );

    const { pageCount } = firstResponse.data.data.pagination;
    console.log("Umumiy sahifalar soni:", pageCount);

    // 1-betdagi malumotlarni bazaga saqlash
    await StudentModel.insertMany(firstResponse.data.data.items, {
      ordered: false,
    });

    // Qolgan sahifalar bo‘yicha loop
    for (let page = 2; page <= pageCount; page++) {
      try {
        console.log(`➡️ Sahifa: ${page}`);

        const { data } = await axios.get(
          "https://student.karsu.uz/rest/v1/data/student-list?limit=200",
          {
            headers: { Authorization: token },
          }
        );

        const students = data.data.items;

        // MongoDB ga yozish
        if (students.length > 0) {
          await StudentModel.insertMany(students, { ordered: false });
          console.log(`✅ ${students.length} ta student saqlandi`);
        }

        // Har sorov orasida 1.5 sekund kutish
        await delay(1500);
      } catch (err) {
        console.error(`❌ Sahifa ${page} da xatolik:`, err.message);
      }
    }

    console.log("🎉 Barcha studentlar yuklandi!");
  } catch (error) {
    console.error("Xatolik:", error.message);
  }
}
