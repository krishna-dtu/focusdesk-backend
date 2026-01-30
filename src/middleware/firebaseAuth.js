const admin = require("../config/firebaseAdmin");

const firebaseAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No Firebase token provided",
      });
    }

    const token = header.split(" ")[1];

    const decodedUser = await admin.auth().verifyIdToken(token);

    req.user = decodedUser;

    next();
  } catch (err) {
    console.log("❌ Firebase Auth Error:", err.message);

    return res.status(401).json({
      message: "Invalid or expired Firebase token",
      error: err.message,
    });
  }
};

module.exports = firebaseAuth;
