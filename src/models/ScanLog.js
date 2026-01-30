const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ScanLog = sequelize.define("ScanLog", {
  requestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  tokenId: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  passType: {
    type: DataTypes.ENUM("IN", "OUT"),
    allowNull: false,
  },

  gateId: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  result: {
    type: DataTypes.ENUM("ALLOW", "DENY"),
    allowNull: false,
  },

  reason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = ScanLog;
