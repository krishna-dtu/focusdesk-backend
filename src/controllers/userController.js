const AccessRequest = require("../models/AccessRequest");
const QRPass = require("../models/QRPass");

/**
 * ✅ User submits access request (Firebase Protected)
 */
const submitAccessRequest = async (req, res) => {
  try {
    const { fullName, idNumber, organisation } = req.body;

    if (!fullName || !idNumber || !organisation) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // ✅ Enforce standard roll format (no slashes)
    if (idNumber.includes("/")) {
      return res.status(400).json({
        message: "Roll number must not contain '/'",
      });
    }

    // ✅ Must be logged in
    if (!req.user || !req.user.uid) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // ✅ Prevent duplicate requests
    const existing = await AccessRequest.findOne({ where: { idNumber } });

    if (existing) {
      return res.status(409).json({
        message: "Request already exists with this ID number",
      });
    }

    // ✅ Create request owned by Firebase UID
    const request = await AccessRequest.create({
      fullName,
      idNumber,
      organisation,
      firebaseUid: req.user.uid,
      firebaseEmail: req.user.email || null,
    });

    return res.status(201).json({
      message: "✅ Access request submitted successfully",
      request,
    });
  } catch (err) {
    console.log("❌ Error submitAccessRequest:", err.message);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * ✅ User fetches BOTH QRs using ID Number (Secure Production API)
 */
const getUserQRByIdNumber = async (req, res) => {
  try {
    const { idNumber } = req.params;

    // ✅ Must be logged in
    if (!req.user || !req.user.uid) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // ✅ Find request
    const request = await AccessRequest.findOne({
      where: { idNumber },
    });

    if (!request) {
      return res.status(404).json({
        message: "No request found for this ID number",
      });
    }

    // ✅ Ownership check
    if (request.firebaseUid !== req.user.uid) {
      return res.status(403).json({
        message: "Unauthorized access",
      });
    }

    // ✅ Not approved yet
    if (request.status !== "APPROVED") {
      return res.json({
        status: request.status,
        rejectionReason: request.rejectionReason,
        message: "QR not issued yet. Wait for admin approval.",
      });
    }

    // ✅ Fetch QR passes
    const passes = await QRPass.findAll({
      where: { requestId: request.id },
    });

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
    console.log("❌ Error getUserQRByIdNumber:", err.message);

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
