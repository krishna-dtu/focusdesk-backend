const AccessRequest = require("../models/AccessRequest");
const QRPass = require("../models/QRPass");

const { generateQRToken } = require("../services/qrService");
const { generateQRImage } = require("../services/qrImageService");

const moment = require("moment-timezone");

/**
 * ✅ View all pending requests
 */
const getPendingRequests = async (req, res) => {
  try {
    const pending = await AccessRequest.findAll({
      where: { status: "PENDING" },
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      count: pending.length,
      requests: pending,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Approve request + Issue BOTH IN and OUT QR
 */
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await AccessRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // ✅ Fetch existing passes
    let passes = await QRPass.findAll({
      where: { requestId: request.id },
    });

    /**
     * ✅ CASE 1:
     * Already Approved + Passes Exist (IN + OUT)
     */
    if (request.status === "APPROVED" && passes.length === 2) {
      return res.json({
        message: "✅ Already Approved. QR Exists",
        request,
        entryQR: passes.find((p) => p.passType === "IN"),
        exitQR: passes.find((p) => p.passType === "OUT"),
      });
    }

    /**
     * ✅ CASE 2:
     * Approved but Passes Missing/Incomplete → REGENERATE CLEANLY
     */
    if (request.status === "APPROVED" && passes.length !== 2) {
      console.log("⚠️ Incomplete QR passes found. Regenerating...");

      // ✅ Delete old incomplete passes
      await QRPass.destroy({
        where: { requestId: request.id },
      });

      const inTok = generateQRToken(request, "IN");
      const outTok = generateQRToken(request, "OUT");

      const entryQR = await QRPass.create({
        requestId: request.id,
        passType: "IN",
        tokenId: inTok.tokenId,
        qrToken: inTok.token,
      });

      const exitQR = await QRPass.create({
        requestId: request.id,
        passType: "OUT",
        tokenId: outTok.tokenId,
        qrToken: outTok.token,
      });

      return res.json({
        message: "✅ QR Pass Regenerated Successfully",
        request,
        entryQR,
        exitQR,
      });
    }

    /**
     * ✅ CASE 3:
     * Fresh Approval (Pending → Approved)
     */
    request.status = "APPROVED";
    request.validFrom = moment().tz("Asia/Kolkata").toDate();
    request.validUntil = moment().tz("Asia/Kolkata").add(24, "hours").toDate();
    request.rejectionReason = null;
    request.currentState = "OUTSIDE";

    await request.save();

    // ✅ Generate Fresh QR Tokens
    const inTok = generateQRToken(request, "IN");
    const outTok = generateQRToken(request, "OUT");

    const entryQR = await QRPass.create({
      requestId: request.id,
      passType: "IN",
      tokenId: inTok.tokenId,
      qrToken: inTok.token,
    });

    const exitQR = await QRPass.create({
      requestId: request.id,
      passType: "OUT",
      tokenId: outTok.tokenId,
      qrToken: outTok.token,
    });

    return res.json({
      message: "✅ Request Approved + IN/OUT QR Issued",
      request,
      entryQR,
      exitQR,
    });
  } catch (err) {
    console.log("❌ APPROVE ERROR:", err.message);

    return res.status(500).json({
      message: "Approval failed",
      error: err.message,
    });
  }
};

/**
 * ✅ Reject request (Reason mandatory)
 */
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required",
      });
    }

    const request = await AccessRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.status = "REJECTED";
    request.rejectionReason = rejectionReason;
    request.validFrom = null;
    request.validUntil = null;

    await request.save();

    // ✅ Delete QR passes
    await QRPass.destroy({ where: { requestId: request.id } });

    return res.json({
      message: "❌ Request Rejected",
      request,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Get both IN and OUT QR Tokens (Admin View)
 */
const getQRPass = async (req, res) => {
  try {
    const { id } = req.params;

    const passes = await QRPass.findAll({
      where: { requestId: id },
    });

    if (!passes.length) {
      return res.status(404).json({
        message: "QR Pass not found",
      });
    }

    return res.json({
      entryQR: passes.find((p) => p.passType === "IN"),
      exitQR: passes.find((p) => p.passType === "OUT"),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Get QR IMAGE for IN or OUT
 */
const getQRImage = async (req, res) => {
  try {
    const { id, type } = req.params;

    const qrPass = await QRPass.findOne({
      where: {
        requestId: id,
        passType: type.toUpperCase(),
      },
    });

    if (!qrPass) {
      return res.status(404).json({
        message: "QR Pass not found",
      });
    }

    const qrImage = await generateQRImage(qrPass.qrToken);

    return res.json({
      passType: qrPass.passType,
      qrImage,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Get all approved users
 */
const getApprovedUsers = async (req, res) => {
  try {
    const approved = await AccessRequest.findAll({
      where: { status: "APPROVED" },
      order: [["updatedAt", "DESC"]],
    });

    return res.json({
      count: approved.length,
      users: approved,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPendingRequests,
  approveRequest,
  rejectRequest,
  getQRPass,
  getQRImage,
  getApprovedUsers,
};
