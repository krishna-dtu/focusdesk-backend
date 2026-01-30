const express = require("express");
const router = express.Router();

const { verifyQR } = require("../controllers/gateController");
const gateAuth = require("../middleware/gateAuth");

/**
 * ✅ Gate Verification API
 */
router.post("/verify", gateAuth, verifyQR);

module.exports = router;
