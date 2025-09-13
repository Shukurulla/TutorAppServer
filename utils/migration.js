// const dogerekUri =
//       "mongodb+srv://shukurullatursinbayev978_db_user:HaClcoSH6ee3wRZS@cluster0.2aomlat.mongodb.net/dogerek";
//     const tutorAppUri =
//       "mongodb+srv://shukurullatursinbayev978:8lfOGVt5658IVHOS@cluster0.gztfp.mongodb.net/TutorApp";

//     const dogerekClient = new MongoClient(dogerekUri);
//     const tutorAppClient = new MongoClient(tutorAppUri);

//     async function migrateStudents() {
//       try {
//         await dogerekClient.connect();
//         await tutorAppClient.connect();

//         const dogerekDb = dogerekClient.db("dogerek");
//         const tutorAppDb = tutorAppClient.db("TutorApp"); // katta harf bilan

//         const dogerekStudents = dogerekDb.collection("students");
//         const tutorAppStudents = tutorAppDb.collection("students");

//         console.log("🔄 TutorApp.students tozalanmoqda...");
//         await tutorAppStudents.deleteMany({}); // eski studentlarni tozalash

//         console.log("📥 Dogerek.students dan hujjatlar olinmoqda...");
//         const cursor = dogerekStudents.find();

//         let batch = [];
//         let count = 0;

//         while (await cursor.hasNext()) {
//           const doc = await cursor.next();
//           batch.push(doc);

//           // batch bo‘lib yozish (5000 tadan)
//           if (batch.length === 5000) {
//             await tutorAppStudents.insertMany(batch);
//             count += batch.length;
//             console.log(`✅ ${count} student ko‘chirildi...`);
//             batch = [];
//           }
//         }

//         // qolganlari
//         if (batch.length > 0) {
//           await tutorAppStudents.insertMany(batch);
//           count += batch.length;
//           console.log(`✅ ${count} student ko‘chirildi (yakun).`);
//         }

//         console.log("🎉 Migration tugadi!");
//       } catch (err) {
//         console.error("❌ Xatolik:", err);
//       } finally {
//         await dogerekClient.close();
//         await tutorAppClient.close();
//       }
//     }

//     migrateStudents();
