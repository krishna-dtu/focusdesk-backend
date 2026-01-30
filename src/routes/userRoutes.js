const express = require("express");
const router = express.Router();

const {
  submitAccessRequest,
  getUserQRByIdNumber,
} = require("../controllers/userController");

const firebaseAuth = require("../middleware/firebaseAuth");

/**
 * ✅ Submit access request (Protected)
 */
router.post("/request-access", firebaseAuth, submitAccessRequest);

/**
 * ✅ Fetch BOTH IN + OUT QR using College ID Number (Protected)
 */
router.get("/qrpass-by-id/:idNumber", firebaseAuth, getUserQRByIdNumber);

module.exports = router;
