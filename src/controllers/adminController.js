const AccessRequest = require("../models/AccessRequest");
const QRPass = require("../models/QRPass");
const ScanLog = require("../models/ScanLog");

const { generateQRToken } = require("../services/qrService");
const { generateQRImage } = require("../services/qrImageService");

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
 * ✅ Approve request
 * FIX: This function now strictly uses the database-stored validity dates.
 */
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await AccessRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // Check if already approved to avoid duplicate DB entries
    if (request.status === "APPROVED") {
      const existingPasses = await QRPass.findAll({ where: { requestId: request.id } });
      if (existingPasses.length === 2) {
        return res.json({ message: "Already Approved", request, passes: existingPasses });
      }
    }

    // ✅ UPDATE STATUS
    request.status = "APPROVED";
    request.rejectionReason = null;
    request.currentState = "OUTSIDE";
    await request.save();

    // ✅ IMPORTANT: Clear old passes if regenerating
    await QRPass.destroy({ where: { requestId: request.id } });

    // ✅ GENERATE TOKENS using the request object 
    // (qrService.js will now read request.validFrom and request.validUntil)
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
      message: "✅ Request Approved with User-Defined Validity",
      request,
      entryQR,
      exitQR,
    });
  } catch (err) {
    console.error("❌ APPROVE ERROR:", err.message);
    return res.status(500).json({ message: "Approval failed", error: err.message });
  }
};

/**
 * ✅ Reject request
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
 * ✅ Get QR Pass Tokens
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
 * ✅ Get QR Image
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
 * ✅ Get Approved Users
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

/**
 * ✅ Get Scan Logs for a User (Admin View Details)
 */
const getUserScanLogs = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await AccessRequest.findByPk(id);

    const logs = await ScanLog.findAll({
      where: { requestId: id },
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      user: request
        ? {
            id: request.id,
            fullName: request.fullName,
            idNumber: request.idNumber,
            organisation: request.organisation,
            validFrom: request.validFrom,
            validUntil: request.validUntil,
            status: request.status,
          }
        : null,
      logs,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Update validity dates for an approved user
 */
const updateUserValidity = async (req, res) => {
  try {
    const { id } = req.params;
    const { validFrom, validUntil } = req.body;

    if (!validFrom || !validUntil) {
      return res.status(400).json({ message: "validFrom and validUntil are required" });
    }

    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);

    if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (fromDate >= untilDate) {
      return res.status(400).json({ message: "validUntil must be after validFrom" });
    }

    const request = await AccessRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ message: "User not found" });
    }

    request.validFrom = fromDate;
    request.validUntil = untilDate;
    await request.save();

    // Regenerate QR tokens with new validity
    await QRPass.destroy({ where: { requestId: request.id } });

    const { generateQRToken } = require("../services/qrService");
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
      message: "✅ Validity dates updated and QR regenerated",
      request,
      entryQR,
      exitQR,
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
  updateUserValidity,
  getUserScanLogs,
};
