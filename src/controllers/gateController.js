const jwt = require("jsonwebtoken");
const QRPass = require("../models/QRPass");
const ScanLog = require("../models/ScanLog");
const AccessRequest = require("../models/AccessRequest");

const verifyQR = async (req, res) => {
  try {
    const { qrToken, gateId } = req.body;
    if (!qrToken || !gateId) {
      return res.status(400).json({
        status: "DENY",
        message: "qrToken and gateId required",
      });
    }

    // ✅ Decode JWT safely: verify signature, but also attempt decode for logging
    let decoded;
    try {
      decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
    } catch (err) {
      // try to decode without verifying to extract requestId/tokenId for logging
      decoded = jwt.decode(qrToken) || {};

      // If we couldn't extract identifying fields, return generic deny
      if (!decoded || !decoded.requestId) {
        return res.json({ status: "DENY", message: "INVALID_TOKEN" });
      }
      // else proceed but mark token invalid (we'll log and deny below)
      await ScanLog.create({
        requestId: decoded.requestId,
        tokenId: decoded.tokenId || null,
        passType: decoded.passType || null,
        gateId,
        result: "DENY",
        reason: "INVALID_SIGNATURE",
      });

      return res.json({ status: "DENY", message: "INVALID_SIGNATURE" });
    }

    const { tokenId, requestId, passType, validUntil } = decoded || {};

    if (!tokenId || !requestId || !passType) {
      // attempt to log if requestId present
      if (requestId) {
        await ScanLog.create({
          requestId,
          tokenId: tokenId || null,
          passType: passType || null,
          gateId,
          result: "DENY",
          reason: "INVALID_QR_PAYLOAD",
        });
      }

      return res.json({ status: "DENY", message: "INVALID_QR_PAYLOAD" });
    }

    // ✅ Expiry Check
    if (validUntil && new Date() > new Date(validUntil)) {
      await ScanLog.create({ requestId, tokenId, passType, gateId, result: "DENY", reason: "QR_EXPIRED" });
      return res.json({ status: "DENY", message: "QR_EXPIRED" });
    }

    // ✅ QRPass must exist exactly
    const qrPass = await QRPass.findOne({
      where: { tokenId, passType },
    });

    if (!qrPass) {
      await ScanLog.create({ requestId, tokenId, passType, gateId, result: "DENY", reason: "PASS_NOT_FOUND" });
      return res.json({ status: "DENY", message: "PASS_NOT_FOUND" });
    }

    // ✅ AccessRequest must exist
    const request = await AccessRequest.findByPk(requestId);

    if (!request) {
      await ScanLog.create({ requestId, tokenId, passType, gateId, result: "DENY", reason: "USER_NOT_FOUND" });
      return res.json({ status: "DENY", message: "USER_NOT_FOUND" });
    }

    // ✅ Must be approved
    if (request.status !== "APPROVED") {
      await ScanLog.create({ requestId, tokenId, passType, gateId, result: "DENY", reason: "NOT_APPROVED" });
      return res.json({ status: "DENY", message: "NOT_APPROVED" });
    }

    // ✅ STATE MACHINE

    // --- ENTRY ---
    if (passType === "IN") {
      if (request.currentState === "INSIDE") {
        await ScanLog.create({ requestId, tokenId, passType, gateId, result: "DENY", reason: "ALREADY_INSIDE" });
        return res.json({ status: "DENY", message: "ALREADY_INSIDE" });
      }

      request.currentState = "INSIDE";
      await request.save();

      await ScanLog.create({ requestId, tokenId, passType, gateId, result: "ALLOW", reason: null });

      return res.json({
        status: "ALLOW",
        message: "ENTRY_GRANTED",
      });
    }

    // --- EXIT ---
    if (passType === "OUT") {
      if (request.currentState === "OUTSIDE") {
        await ScanLog.create({ requestId, tokenId, passType, gateId, result: "DENY", reason: "ALREADY_OUTSIDE" });
        return res.json({ status: "DENY", message: "ALREADY_OUTSIDE" });
      }

      request.currentState = "OUTSIDE";
      await request.save();

      await ScanLog.create({ requestId, tokenId, passType, gateId, result: "ALLOW", reason: null });

      return res.json({
        status: "ALLOW",
        message: "EXIT_GRANTED",
      });
    }

    return res.json({
      status: "DENY",
      message: "INVALID_PASS_TYPE",
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
