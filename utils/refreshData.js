import axios from "axios";
import StudentModel from "../models/student.model.js";

// Sahifa yuklash timeoutini qisqa qilish
const AXIOS_TIMEOUT = 8000;
const CONCURRENT_REQUESTS = 10; // Parallel so'rovlar soni oshirildi

// Student ma'lumotlarini tozalash
const cleanStudentData = (studentData) => {
  if (!studentData || !studentData.student_id_number) return null;

  return {
    ...studentData,
    specialty: studentData.specialty
      ? { ...studentData.specialty, id: String(studentData.specialty.id) }
      : undefined,
    group: studentData.group
      ? { ...studentData.group, id: String(studentData.group.id) }
      : undefined,
    department: studentData.department
      ? { ...studentData.department, id: String(studentData.department.id) }
      : undefined,
    semester: studentData.semester
      ? { ...studentData.semester, id: String(studentData.semester.id) }
      : undefined,
  };
};

// Mavjud student ID larni olish (memory'da saqlash)
const getExistingStudentIds = async () => {
  try {
    const existingIds = await StudentModel.distinct("student_id_number");
    return new Set(existingIds);
  } catch (error) {
    console.error("❌ Mavjud student ID larni olishda xato:", error.message);
    return new Set();
  }
};

// Yangi studentlarni batch qo'shish
const insertNewStudentsBatch = async (newStudents) => {
  if (!newStudents || newStudents.length === 0) return { created: 0 };

  try {
    const result = await StudentModel.insertMany(newStudents, {
      ordered: false,
      writeConcern: { w: 1, j: false }, // Performance uchun
    });
    return { created: result.length };
  } catch (error) {
    // Duplicate key errors ni ignore qilamiz
    if (error.code === 11000) {
      const successfulInserts = error.result?.insertedCount || 0;
      console.log(
        `⚠️  ${
          error.writeErrors?.length || 0
        } ta duplicate topildi, ${successfulInserts} ta yangi student qo'shildi`
      );
      return { created: successfulInserts };
    }
    console.error("❌ Batch insert error:", error.message);
    return { created: 0 };
  }
};

// Biror sahifani olish (retry logic bilan)
const fetchPageWithRetry = async (page, token, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(
        `https://student.karsu.uz/rest/v1/data/student-list?page=${page}&limit=200`,
        {
          headers: { Authorization: token },
          timeout: AXIOS_TIMEOUT,
        }
      );
      return response.data.data.items || [];
    } catch (err) {
      if (attempt === retries) {
        console.error(
          `❌ Sahifa ${page} da xato (${retries + 1} urinish):`,
          err.message
        );
        return [];
      }
      // Qisqa kutish va qayta urinish
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return [];
};

// Progress tracker
const createProgressTracker = (total) => {
  let processed = 0;
  const startTime = Date.now();

  return {
    update: (count) => {
      processed += count;
      const percentage = Math.round((processed / total) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining =
        processed > 0
          ? Math.round((elapsed * (total - processed)) / processed)
          : 0;

      console.log(
        `📊 Progress: ${percentage}% (${processed}/${total}) | ⏱️ ${elapsed}s o'tdi, ~${remaining}s qoldi`
      );
    },
  };
};

// 🚀 Asosiy funksiya - to'liq qayta yozilgan
export async function autoRefreshStudentData() {
  const startTime = Date.now();
  const token = "Bearer erkFR_9u2IOFoaGxYQPDmjmXVe6Oqv3s";

  try {
    console.log("\n🚀 STUDENT DATA AUTO REFRESH START (OPTIMIZED)");

    // 1. API dan jami ma'lumotlar sonini olamiz
    console.log("📡 API ma'lumotlarini tekshirish...");
    const firstResp = await axios.get(
      "https://student.karsu.uz/rest/v1/data/student-list?limit=200",
      {
        headers: { Authorization: token },
        timeout: AXIOS_TIMEOUT,
      }
    );

    const { pageCount, totalCount } = firstResp.data.data.pagination;
    console.log(`📊 API jami: ${totalCount} student, ${pageCount} sahifa`);

    // 2. Bazadagi mavjud ma'lumotlarni tekshiramiz
    console.log("💾 Bazadagi ma'lumotlarni tekshirish...");
    const [currentDbCount, existingIds] = await Promise.all([
      StudentModel.countDocuments(),
      getExistingStudentIds(),
    ]);

    console.log(`💾 Bazada mavjud: ${currentDbCount} student`);
    console.log(`🔍 Mavjud ID lar yuklandi: ${existingIds.size} ta`);

    // 3. Agar bazadagi soni API bilan deyarli bir xil bo'lsa, yangilanish kerak emas
    const difference = Math.abs(totalCount - currentDbCount);
    if (difference <= 5) {
      console.log(
        `✅ Ma'lumotlar deyarli bir xil (farq: ${difference}). Yangilanish kerak emas.`
      );
      return {
        success: true,
        duration: Math.round((Date.now() - startTime) / 1000),
        processed: 0,
        created: 0,
        skipped: true,
        finalCount: currentDbCount,
        message: "Ma'lumotlar allaqachon yangi",
      };
    }

    console.log(`🔄 ${difference} ta yangi student kutilmoqda...`);

    // 4. Progress tracker yaratamiz
    const progress = createProgressTracker(totalCount);

    // 5. Parallel ravishda sahifalarni yuklaymiz va faqat yangi studentlarni qo'shamiz
    let totalCreated = 0;
    let totalProcessed = 0;
    let newStudentsBatch = [];
    const BATCH_SIZE = 1000; // Har 1000 tadan batch qilib qo'shamiz

    console.log(
      `⚡ ${CONCURRENT_REQUESTS} ta parallel so'rov bilan yuklash boshlandi...`
    );

    for (let i = 1; i <= pageCount; i += CONCURRENT_REQUESTS) {
      // Parallel sahifalarni yuklash
      const pagePromises = [];
      for (let j = 0; j < CONCURRENT_REQUESTS && i + j <= pageCount; j++) {
        const pageNum = i + j;
        if (pageNum === 1) {
          // Birinchi sahifa allaqachon olingan
          pagePromises.push(Promise.resolve(firstResp.data.data.items || []));
        } else {
          pagePromises.push(fetchPageWithRetry(pageNum, token));
        }
      }

      const pageResults = await Promise.all(pagePromises);

      // Har bir sahifadagi studentlarni qayta ishlaymiz
      for (const students of pageResults) {
        for (const studentData of students) {
          totalProcessed++;
          const cleanedData = cleanStudentData(studentData);

          if (cleanedData && !existingIds.has(cleanedData.student_id_number)) {
            newStudentsBatch.push(cleanedData);
            existingIds.add(cleanedData.student_id_number); // Takrorlanmaslik uchun qo'shamiz
          }
        }
      }

      // Batch hajmi yetganda bazaga qo'shamiz
      if (newStudentsBatch.length >= BATCH_SIZE) {
        const { created } = await insertNewStudentsBatch(newStudentsBatch);
        totalCreated += created;
        newStudentsBatch = []; // Batch ni tozalaymiz
      }

      progress.update(pageResults.reduce((sum, page) => sum + page.length, 0));
    }

    // Oxirgi batch ni ham qo'shamiz
    if (newStudentsBatch.length > 0) {
      const { created } = await insertNewStudentsBatch(newStudentsBatch);
      totalCreated += created;
    }

    // 6. Yakuniy statistika
    const finalCount = await StudentModel.countDocuments();
    const [genderStats, levelStats] = await Promise.all([
      StudentModel.aggregate([
        { $group: { _id: "$gender.name", count: { $sum: 1 } } },
      ]),
      StudentModel.aggregate([
        { $group: { _id: "$level.name", count: { $sum: 1 } } },
      ]),
    ]);

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log("\n🎉 OPTIMIZED REFRESH COMPLETED");
    console.log(`⏱️  Vaqt: ${duration} sekund`);
    console.log(`📥 API dan olindi: ${totalProcessed} student`);
    console.log(`✨ Bazaga qo'shildi: ${totalCreated} yangi student`);
    console.log(`💾 Bazada jami: ${finalCount} student`);
    console.log(
      `🎯 API vs Baza: ${totalCount} vs ${finalCount} (farq: ${Math.abs(
        totalCount - finalCount
      )})`
    );
    console.log(`👤 Jins bo'yicha:`, genderStats);
    console.log(`🎓 Daraja bo'yicha:`, levelStats);

    return {
      success: true,
      duration,
      processed: totalProcessed,
      created: totalCreated,
      finalCount,
      apiCount: totalCount,
      genderStats,
      levelStats,
      efficiency: `${Math.round(totalProcessed / duration)} student/sekund`,
    };
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error("❌ OPTIMIZED REFRESH FAILED:", error.message);

    return {
      success: false,
      duration,
      error: error.message,
      suggestion: "Internet aloqasini yoki API tokenini tekshiring",
    };
  }
}
