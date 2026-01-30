const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const generateQRToken = (request, passType) => {
  if (!passType) throw new Error("passType required");

  const tokenId = uuidv4();

  const payload = {
    requestId: request.id,
    tokenId,
    passType,
    validUntil: request.validUntil,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET);

  return { tokenId, token };
};

module.exports = { generateQRToken };
