const jwt = require("jsonwebtoken");

const QRPass = require("../models/QRPass");
const AccessRequest = require("../models/AccessRequest");
const ScanLog = require("../models/ScanLog");

/**
 * ✅ Hardware Compatible Endpoint
 * POST /validate
 * Body: { qrData: "..." }
 * Response: { access: true/false }
 */
const validateHardwareQR = async (req, res) => {
    try {
        const qrData = req.body?.qrData;

        if (!qrData) {
            return res.status(400).json({
                access: false,
                message: "Missing QR Data",
            });
        }

        // ✅ Verify JWT Token
        let decoded;
        try {
            decoded = jwt.verify(qrData, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({
                access: false,
                message: "Invalid QR",
            });
        }

        const { tokenId, passType, requestId, validUntil } = decoded;

        // ✅ Expiry Check
        if (new Date() > new Date(validUntil)) {
            return res.status(401).json({
                access: false,
                message: "QR Expired",
            });
        }

        // ✅ QR must exist
        const qrPass = await QRPass.findOne({ where: { tokenId } });
        if (!qrPass) {
            return res.status(401).json({
                access: false,
                message: "QR Not Found",
            });
        }

        // ✅ Get User
        const user = await AccessRequest.findByPk(requestId);
        if (!user) {
            return res.status(401).json({
                access: false,
                message: "User Not Found",
            });
        }

        /**
         * ✅ STATE MACHINE SECURITY
         */
        if (passType === "IN") {
            if (user.currentState !== "OUTSIDE") {
                return res.status(401).json({
                    access: false,
                    message: "Already Inside",
                });
            }

            user.currentState = "INSIDE";
            await user.save();

            await ScanLog.create({
                tokenId,
                gateId: "ROOM_ENTRY",
                result: "ALLOW",
                reason: "ENTRY_ALLOWED",
            });

            return res.status(200).json({
                access: true,
                message: "Welcome (Entry)",
            });
        }

        if (passType === "OUT") {
            if (user.currentState !== "INSIDE") {
                return res.status(401).json({
                    access: false,
                    message: "Already Outside",
                });
            }

            user.currentState = "OUTSIDE";
            await user.save();

            await ScanLog.create({
                tokenId,
                gateId: "ROOM_EXIT",
                result: "ALLOW",
                reason: "EXIT_ALLOWED",
            });

            return res.status(200).json({
                access: true,
                message: "Goodbye (Exit)",
            });
        }

        return res.status(401).json({
            access: false,
            message: "Invalid Pass Type",
        });
    } catch (err) {
        console.log("VALIDATE ERROR:", err);

        return res.status(500).json({
            access: false,
            message: "Server Error",
            error: err.message,
        });

    }
};

module.exports = { validateHardwareQR };
