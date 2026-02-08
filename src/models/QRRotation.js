const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * QRRotation Model - Tracks active QR rotation to prevent abuse
 */
const QRRotation = sequelize.define("QRRotation", {
  requestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },

  activeQRType: {
    type: DataTypes.ENUM("IN", "OUT"),
    allowNull: false,
  },

  rotationTimestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },

  lastScanTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  scanAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  isRestricted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  restrictionUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = QRRotation;
