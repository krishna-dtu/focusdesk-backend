const express = require("express");
const router = express.Router();

const {
  submitAccessRequest,
  getUserQRByIdNumber,
  getMyContributionCalendar,
  getActiveQR,
  getMyProfile,
  updateMyProfile,
} = require("../controllers/userController");

const firebaseAuth = require("../middleware/firebaseAuth");

/**
 * ✅ Submit access request (No auth required - users submit before login)
 */
router.post("/request-access", submitAccessRequest);

/**
 * ✅ Fetch BOTH IN + OUT QR using College ID Number (Protected)
 */
router.get("/qrpass-by-id/:idNumber", firebaseAuth, getUserQRByIdNumber);

/**
 * ✅ Get user's contribution calendar
 */
router.get("/calendar/:idNumber", firebaseAuth, getMyContributionCalendar);

/**
 * ✅ Get active QR (dynamic rotation)
 */
router.get("/active-qr/:idNumber", firebaseAuth, getActiveQR);

/**
 * ✅ Get user's own profile
 */
router.get("/profile/:idNumber", firebaseAuth, getMyProfile);

/**
 * ✅ Update user's own profile
 */
router.put("/profile/:idNumber", firebaseAuth, updateMyProfile);

module.exports = router;
