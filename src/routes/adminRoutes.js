const express = require("express");
const router = express.Router();

const {
  getPendingRequests,
  approveRequest,
  rejectRequest,
  getQRPass,
  getQRImage, // ✅ MUST BE HERE
  getApprovedUsers,
  updateUserValidity,
  getUserScanLogs,
} = require("../controllers/adminController");

const { getAttendance } = require("../controllers/attendanceController");

// Requests
router.get("/requests", getPendingRequests);
router.get("/approved", getApprovedUsers);

// Approval
router.post("/approve/:id", approveRequest);
router.post("/reject/:id", rejectRequest);

// Update validity dates for approved user
router.patch("/update-validity/:id", updateUserValidity);

// View scan logs for a user
router.get("/scanlogs/:id", getUserScanLogs);

// Fetch tokens
router.get("/qrpass/:id", getQRPass);

// ✅ QR IMAGE ROUTE (IN/OUT)
router.get("/qrimage/:id/:type", getQRImage);

// ✅ ATTENDANCE TRACKING
router.get("/attendance", getAttendance);

module.exports = router;
