const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

/**
 * ✅ UNIVERSAL FIX: Hard-binds JWT Expiry to Database validUntil
 */
const generateQRToken = (request, passType) => {
  const tokenId = uuidv4();

  if (!request.validUntil) {
    throw new Error("CRITICAL: Cannot generate QR without validUntil timestamp.");
  }

  const expiryDate = new Date(request.validUntil);
  const now = new Date();
  
  // Calculate exact seconds from right now until the user-selected end time
  const secondsRemaining = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);

  // If the time has already passed, we give it a 1-second expiry (instantly invalid)
  // This prevents the 'expiresIn' from being negative or null
  const expiresInSeconds = secondsRemaining > 0 ? secondsRemaining : 1;

  const payload = {
    tokenId,
    requestId: request.id,
    idNumber: request.idNumber,
    passType,
    // Embed the window in the payload for hardware verification
    validFrom: request.validFrom,
    validUntil: request.validUntil,
  };

  // ✅ FORCED TTL: This overrides any global defaults
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresInSeconds, 
  });

  return { tokenId, token };
};

module.exports = { generateQRToken };