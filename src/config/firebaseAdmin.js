const admin = require("firebase-admin");
const path = require("path");

if (!admin.apps.length) {
  try {
    // Try to use environment variables first (for production/Render)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
      console.log("✅ Firebase Admin Initialized (ENV variables)");
    } 
    // Fall back to serviceAccountKey.json (for local development)
    else {
      const serviceAccount = require("../../serviceAccountKey.json");
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin Initialized (serviceAccountKey.json)");
    }
  } catch (err) {
    console.log("❌ Firebase Admin Init Failed:", err.message);
  }
}

module.exports = admin;
