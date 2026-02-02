const jwt = require("jsonwebtoken");
const QRPass = require("../models/QRPass");
const ScanLog = require("../models/ScanLog");
const AccessRequest = require("../models/AccessRequest");

const verifyQR = async (req, res) => {
  try {
    // ✅ FIX: req.body can be undefined from hardware requests
    const body = req.body || {};
    const { qrToken, gateId } = body;

    if (!qrToken || !gateId) {
      return res.status(400).json({
        status: "DENY",
        message: "qrToken and gateId required",
      });
    }

    // ✅ Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.json({
        status: "DENY",
        message: "INVALID_SIGNATURE",
      });
    }

    const { tokenId, requestId, passType, validFrom, validUntil } = decoded;

    if (!tokenId || !requestId || !passType) {
      return res.json({
        status: "DENY",
        message: "INVALID_QR_PAYLOAD",
      });
    }

    // ✅ Expiry check (JWT) - Check both validFrom and validUntil
    const now = new Date();

    if (validFrom && now < new Date(validFrom)) {
      await ScanLog.create({
        requestId,
        tokenId,
        passType,
        gateId,
        result: "DENY",
        reason: "QR_NOT_STARTED_YET",
      });

      return res.json({
        status: "DENY",
        message: "QR_NOT_STARTED_YET",
      });
    }

    if (validUntil && now > new Date(validUntil)) {
      await ScanLog.create({
        requestId,
        tokenId,
        passType,
        gateId,
        result: "DENY",
        reason: "QR_EXPIRED",
      });

      return res.json({
        status: "DENY",
        message: "QR_EXPIRED",
      });
    }

    // ✅ QRPass must exist
    const qrPass = await QRPass.findOne({
      where: { tokenId, passType },
    });

    if (!qrPass) {
      await ScanLog.create({
        requestId,
        tokenId,
        passType,
        gateId,
        result: "DENY",
        reason: "PASS_NOT_FOUND",
      });

      return res.json({
        status: "DENY",
        message: "PASS_NOT_FOUND",
      });
    }

    // ✅ Fetch Access Request
    const request = await AccessRequest.findByPk(requestId);

    if (!request) {
      return res.json({
        status: "DENY",
        message: "USER_NOT_FOUND",
      });
    }

    if (request.status !== "APPROVED") {
      return res.json({
        status: "DENY",
        message: "NOT_APPROVED",
      });
    }

    // ✅ NEW: Enforce Validity Start + End (User Selected) - using 'now' from JWT check above

    if (request.validFrom && now < new Date(request.validFrom)) {
      return res.json({
        status: "DENY",
        message: "PASS_NOT_STARTED_YET",
      });
    }

    if (request.validUntil && now > new Date(request.validUntil)) {
      return res.json({
        status: "DENY",
        message: "PASS_EXPIRED",
      });
    }

    // ✅ ENTRY
    if (passType === "IN") {
      if (request.currentState === "INSIDE") {
        return res.json({
          status: "DENY",
          message: "ALREADY_INSIDE",
        });
      }

      request.currentState = "INSIDE";
      await request.save();
    }

    // ✅ EXIT
    if (passType === "OUT") {
      if (request.currentState === "OUTSIDE") {
        return res.json({
          status: "DENY",
          message: "ALREADY_OUTSIDE",
        });
      }

      request.currentState = "OUTSIDE";
      await request.save();
    }

    // ✅ Log scan
    await ScanLog.create({
      requestId,
      tokenId,
      passType,
      gateId,
      result: "ALLOW",
      reason: null,
    });

    return res.json({
      status: "ALLOW",
      message: passType === "IN" ? "ENTRY_GRANTED" : "EXIT_GRANTED",
    });
  } catch (err) {
    console.log("VERIFY ERROR:", err.message);

    return res.status(500).json({
      status: "DENY",
      error: err.message,
    });
  }
};

module.exports = { verifyQR };
