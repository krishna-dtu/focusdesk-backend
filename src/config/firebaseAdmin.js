const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    // ✅ Render-safe Firebase Admin initialization using ENV variables
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
          : null,
      }),
    });

    console.log("✅ Firebase Admin Initialized (Render ENV)");

  } catch (err) {
    console.log("❌ Firebase Admin Init Failed:", err.message);
  }
}

module.exports = admin;
