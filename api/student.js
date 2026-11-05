const admin = require("firebase-admin");

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Firebase server credentials are missing");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, "\n")
    })
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const {
      fullName,
      nationalId,
      sectionNumber,
      serialNumber
    } = req.body || {};

    if (
      typeof fullName !== "string" ||
      typeof nationalId !== "string" ||
      !/^\d{14}$/.test(nationalId) ||
      !Number.isInteger(Number(sectionNumber)) ||
      !Number.isInteger(Number(serialNumber))
    ) {
      return res.status(400).json({
        success: false,
        message: "بيانات غير صحيحة"
      });
    }

    const section = Number(sectionNumber);
    const serial = Number(serialNumber);

    if (
      section < 1 || section > 16 ||
      serial < 1 || serial > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "رقم الشعبة أو التسلسل غير صحيح"
      });
    }

    const snapshot = await db
      .collection("students")
      .where("national_id", "==", nationalId)
      .limit(2)
      .get();

    if (snapshot.size !== 1) {
      return res.status(404).json({
        success: false,
        message: "بيانات الطالب غير موجودة أو غير متطابقة"
      });
    }

    const doc = snapshot.docs[0];
    const student = doc.data();

    if (
      student.full_name !== fullName.trim() ||
      Number(student.section_number) !== section ||
      Number(student.serial_number) !== serial
    ) {
      return res.status(404).json({
        success: false,
        message: "بيانات الطالب غير متطابقة"
      });
    }

    return res.status(200).json({
      success: true,
      student: {
        id: doc.id,
        fullName: student.full_name,
        sectionNumber: section,
        serialNumber: serial,
        studentCode: student.student_code || ""
      }
    });

  } catch (error) {
    console.error("Student verification error:", error.message);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء التحقق من البيانات"
    });
  }
};
