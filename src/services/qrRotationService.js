const QRRotation = require("../models/QRRotation");
const AccessRequest = require("../models/AccessRequest");

/**
 * Get or create QR rotation state for a user
 */
const getActiveQRType = async (requestId) => {
  try {
    const request = await AccessRequest.findByPk(requestId);
    if (!request) {
      throw new Error("User not found");
    }

    let rotation = await QRRotation.findOne({ where: { requestId } });

    if (!rotation) {
      // Create initial rotation based on current state
      rotation = await QRRotation.create({
        requestId,
        activeQRType: request.currentState === "OUTSIDE" ? "IN" : "OUT",
        rotationTimestamp: new Date(),
      });
    }

    // Check if rotation needs update (every 30 seconds)
    const timeSinceRotation = Date.now() - new Date(rotation.rotationTimestamp).getTime();
    const ROTATION_INTERVAL = 30000; // 30 seconds

    if (timeSinceRotation > ROTATION_INTERVAL) {
      // Flip QR type
      rotation.activeQRType = rotation.activeQRType === "IN" ? "OUT" : "IN";
      rotation.rotationTimestamp = new Date();
      await rotation.save();
    }

    return rotation;
  } catch (err) {
    console.error("QR rotation error:", err.message);
    throw err;
  }
};

/**
 * Check if user is restricted due to abuse
 */
const checkRestriction = async (requestId) => {
  try {
    const rotation = await QRRotation.findOne({ where: { requestId } });

    if (!rotation) {
      return { isRestricted: false };
    }

    if (rotation.isRestricted && rotation.restrictionUntil) {
      if (new Date() < new Date(rotation.restrictionUntil)) {
        return {
          isRestricted: true,
          until: rotation.restrictionUntil,
        };
      } else {
        // Restriction expired, clear it
        rotation.isRestricted = false;
        rotation.restrictionUntil = null;
        rotation.scanAttempts = 0;
        await rotation.save();
      }
    }

    return { isRestricted: false };
  } catch (err) {
    console.error("Restriction check error:", err.message);
    return { isRestricted: false };
  }
};

/**
 * Apply restriction for abuse
 */
const applyRestriction = async (requestId, durationMinutes = 15) => {
  try {
    let rotation = await QRRotation.findOne({ where: { requestId } });

    if (!rotation) {
      rotation = await QRRotation.create({
        requestId,
        activeQRType: "IN",
      });
    }

    rotation.isRestricted = true;
    rotation.restrictionUntil = new Date(Date.now() + durationMinutes * 60000);
    await rotation.save();

    return rotation;
  } catch (err) {
    console.error("Apply restriction error:", err.message);
    throw err;
  }
};

/**
 * Record scan attempt
 */
const recordScanAttempt = async (requestId) => {
  try {
    let rotation = await QRRotation.findOne({ where: { requestId } });

    if (!rotation) {
      rotation = await QRRotation.create({
        requestId,
        activeQRType: "IN",
      });
    }

    const now = new Date();
    const lastScan = rotation.lastScanTime ? new Date(rotation.lastScanTime) : null;

    // Reset counter if last scan was more than 1 minute ago
    if (!lastScan || (now - lastScan) > 60000) {
      rotation.scanAttempts = 1;
    } else {
      rotation.scanAttempts += 1;
    }

    rotation.lastScanTime = now;
    await rotation.save();

    // Apply restriction if too many attempts
    if (rotation.scanAttempts > 3) {
      await applyRestriction(requestId, 15);
      return { shouldRestrict: true, attempts: rotation.scanAttempts };
    }

    return { shouldRestrict: false, attempts: rotation.scanAttempts };
  } catch (err) {
    console.error("Record scan attempt error:", err.message);
    throw err;
  }
};

module.exports = {
  getActiveQRType,
  checkRestriction,
  applyRestriction,
  recordScanAttempt,
};
