const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Expect a serviceAccountKey.json at the project root (not checked into VCS)
const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json");

if (fs.existsSync(serviceAccountPath)) {
  // Initialize normally
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
  admin.__configured = true;
  module.exports = admin;
} else {
  // Export a shim that surfaces configuration status without crashing the app.
  console.error(`Firebase serviceAccountKey.json not found at ${serviceAccountPath}. Firebase Auth disabled.`);

  const shim = {
    __configured: false,
    auth() {
      return {
        verifyIdToken: async () => {
          throw new Error("FIREBASE_NOT_CONFIGURED");
        },
      };
    },
  };

  module.exports = shim;
}
