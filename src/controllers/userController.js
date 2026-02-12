const AccessRequest = require("../models/AccessRequest");
const QRPass = require("../models/QRPass");
const { getContributionCalendar } = require("../services/activityService");
const { getActiveQRType, checkRestriction } = require("../services/qrRotationService");

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
    const existing = await AccessRequest.findOne({ idNumber });
    if (existing) {
      return res.status(409).json({ message: "Request already exists with this ID number" });
    }

    // ✅ Create request with stored validity window
    // Firebase auth is optional - users can submit before logging in
    const request = await AccessRequest.create({
      fullName,
      idNumber,
      organisation,
      validFrom: fromDate,
      validUntil: untilDate,
      firebaseUid: req.user?.uid || null,
      firebaseEmail: req.user?.email || null,
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

    const request = await AccessRequest.findOne({ idNumber });

    if (!request) {
      return res.status(404).json({ message: "No request found for this ID number" });
    }

    // ✅ Link Firebase UID if not already linked
    if (!request.firebaseUid) {
      request.firebaseUid = req.user.uid;
      request.firebaseEmail = req.user.email;
      await request.save();
    }

    // ✅ Check if Firebase UID matches
    if (request.firebaseUid !== req.user.uid) {
      return res.status(403).json({ message: "This ID is registered to another account" });
    }

    if (request.status !== "APPROVED") {
      return res.json({
        status: request.status,
        rejectionReason: request.rejectionReason,
        message: "QR not issued yet. Wait for admin approval.",
      });
    }

    const passes = await QRPass.find({ requestId: request._id });

    // ✅ Return only the active QR based on currentState
    const activeQRType = request.currentState === "OUTSIDE" ? "IN" : "OUT";
    const activePass = passes.find((p) => p.passType === activeQRType);

    return res.json({
      status: "APPROVED",
      fullName: request.fullName,
      idNumber: request.idNumber,
      organisation: request.organisation,
      validFrom: request.validFrom,
      validUntil: request.validUntil,
      currentState: request.currentState,
      activeQRType: activeQRType,
      activeQR: activePass,
      // Still send both for backward compatibility
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

/**
 * ✅ Get user's own contribution calendar
 */
const getMyContributionCalendar = async (req, res) => {
  try {
    const { idNumber } = req.params;

    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const request = await AccessRequest.findOne({ idNumber });

    if (!request) {
      return res.status(404).json({ message: "No request found" });
    }

    if (request.firebaseUid !== req.user.uid) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // Get last 90 days
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const calendar = await getContributionCalendar(request._id.toString(), startDate, endDate);

    const totalDays = calendar.length;
    const totalDuration = calendar.reduce((sum, day) => sum + day.totalDuration, 0);

    return res.json({
      calendar,
      statistics: {
        totalDays,
        totalDuration,
        averageDuration: totalDays > 0 ? Math.round(totalDuration / totalDays) : 0,
      },
    });
  } catch (err) {
    console.error("Calendar fetch error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Get active QR type (for dynamic rotation)
 */
const getActiveQR = async (req, res) => {
  try {
    const { idNumber } = req.params;

    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const request = await AccessRequest.findOne({ idNumber });

    if (!request) {
      return res.status(404).json({ message: "No request found" });
    }

    if (request.firebaseUid !== req.user.uid) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    if (request.status !== "APPROVED") {
      return res.json({
        status: request.status,
        message: "Not approved yet",
      });
    }

    // Check for restrictions
    const restrictionCheck = await checkRestriction(request._id.toString());
    if (restrictionCheck.isRestricted) {
      return res.json({
        status: "RESTRICTED",
        message: "Temporarily restricted due to abuse detection",
        restrictionUntil: restrictionCheck.until,
      });
    }

    // Get active QR type
    const rotation = await getActiveQRType(request._id.toString());

    // Get the appropriate QR pass
    const passes = await QRPass.find({ requestId: request._id });
    const activePass = passes.find((p) => p.passType === rotation.activeQRType);

    return res.json({
      status: "APPROVED",
      activeQRType: rotation.activeQRType,
      qrToken: activePass?.qrToken,
      rotationTimestamp: rotation.rotationTimestamp,
      currentState: request.currentState,
    });
  } catch (err) {
    console.error("Active QR fetch error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Get user's own profile
 */
const getMyProfile = async (req, res) => {
  try {
    const { idNumber } = req.params;

    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const request = await AccessRequest.findOne({ idNumber });

    if (!request) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (request.firebaseUid !== req.user.uid) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    return res.json({
      profile: {
        id: request._id,
        fullName: request.fullName,
        idNumber: request.idNumber,
        organisation: request.organisation,
        profilePicture: request.profilePicture,
        phoneNumber: request.phoneNumber,
        email: request.email,
        department: request.department,
        year: request.year,
        bio: request.bio,
        status: request.status,
        validFrom: request.validFrom,
        validUntil: request.validUntil,
      },
    });
  } catch (err) {
    console.error("Profile fetch error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Update user's own profile
 */
const updateMyProfile = async (req, res) => {
  try {
    const { idNumber } = req.params;
    const { profilePicture, phoneNumber, email, department, year, bio } = req.body;

    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const request = await AccessRequest.findOne({ idNumber });

    if (!request) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (request.firebaseUid !== req.user.uid) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // Update only allowed fields
    if (profilePicture !== undefined) request.profilePicture = profilePicture;
    if (phoneNumber !== undefined) request.phoneNumber = phoneNumber;
    if (email !== undefined) request.email = email;
    if (department !== undefined) request.department = department;
    if (year !== undefined) request.year = year;
    if (bio !== undefined) request.bio = bio;

    await request.save();

    return res.json({
      message: "Profile updated successfully",
      profile: {
        id: request._id,
        fullName: request.fullName,
        idNumber: request.idNumber,
        organisation: request.organisation,
        profilePicture: request.profilePicture,
        phoneNumber: request.phoneNumber,
        email: request.email,
        department: request.department,
        year: request.year,
        bio: request.bio,
      },
    });
  } catch (err) {
    console.error("Profile update error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  submitAccessRequest,
  getUserQRByIdNumber,
  getMyContributionCalendar,
  getActiveQR,
  getMyProfile,
  updateMyProfile,
};
