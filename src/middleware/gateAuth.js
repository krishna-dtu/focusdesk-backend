module.exports = (req, res, next) => {
  const key = req.headers["x-gate-key"];

  if (!key || key !== process.env.GATE_SECRET_KEY) {
    return res.status(401).json({
      status: "DENY",
      message: "UNAUTHORIZED_GATE",
    });
  }

  next();
};
