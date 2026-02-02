const AccessRequest = require("../models/AccessRequest");
const QRPass = require("../models/QRPass");

/**
 * ✅ User submits access request (Firebase Protected)
 * Ensures user-selected dates are stored as proper Date objects
 */
const submitAccessRequest = async (req, res) => {
  try {
    const { fullName, idNumber, organisation, validFrom, validUntil } = req.body;

    // Basic validation
    if (!fullName || !idNumber || !organisation) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Enforce standard roll format
    if (idNumber.includes("/")) {
      return res.status(400).json({ message: "Roll number must not contain '/'" });
    }

    // Authentication check
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Validity dates check
    if (!validFrom || !validUntil) {
      return res.status(400).json({ message: "Valid From and Valid Until are required" });
    }

    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);
    const now = new Date();

    // Date logic validation
    if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (fromDate >= untilDate) {
      return res.status(400).json({ message: "Valid Until must be after Valid From" });
    }

    if (untilDate <= now) {
      return res.status(400).json({ message: "Valid Until cannot be in the past" });
    }

    // Prevent duplicate requests
    const existing = await AccessRequest.findOne({ where: { idNumber } });
    if (existing) {
      return res.status(409).json({ message: "Request already exists with this ID number" });
    }

    // ✅ Create request with stored validity window
    const request = await AccessRequest.create({
      fullName,
      idNumber,
      organisation,
      validFrom: fromDate,
      validUntil: untilDate,
      firebaseUid: req.user.uid,
      firebaseEmail: req.user.email || null,
      status: "PENDING"
    });

    return res.status(201).json({
      message: "✅ Access request submitted successfully",
      request,
    });
  } catch (err) {
    console.error("❌ Error submitAccessRequest:", err.message);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * ✅ User fetches BOTH QRs using ID Number
 */
const getUserQRByIdNumber = async (req, res) => {
  try {
    const { idNumber } = req.params;

    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const request = await AccessRequest.findOne({ where: { idNumber } });

    if (!request) {
      return res.status(404).json({ message: "No request found for this ID number" });
    }

    if (request.firebaseUid !== req.user.uid) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    if (request.status !== "APPROVED") {
      return res.json({
        status: request.status,
        rejectionReason: request.rejectionReason,
        message: "QR not issued yet. Wait for admin approval.",
      });
    }

    const passes = await QRPass.findAll({ where: { requestId: request.id } });

    return res.json({
      status: "APPROVED",
      fullName: request.fullName,
      idNumber: request.idNumber,
      organisation: request.organisation,
      validFrom: request.validFrom,
      validUntil: request.validUntil,
      entryQR: passes.find((p) => p.passType === "IN"),
      exitQR: passes.find((p) => p.passType === "OUT"),
    });
  } catch (err) {
    console.error("❌ Error getUserQRByIdNumber:", err.message);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

module.exports = {
  submitAccessRequest,
  getUserQRByIdNumber,
};