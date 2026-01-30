const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const QRPass = sequelize.define(
  "QRPass",
  {
    requestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // ✅ IN or OUT pass
    passType: {
      type: DataTypes.ENUM("IN", "OUT"),
      allowNull: false,
    },

    // ✅ Unique token identifier
    tokenId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    // ✅ Actual signed JWT stored
    qrToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // ✅ ACTIVE → USED → REVOKED
    status: {
      type: DataTypes.ENUM("ACTIVE", "USED", "REVOKED"),
      defaultValue: "ACTIVE",
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["requestId", "passType"], // ✅ Only one IN and one OUT per request
      },
    ],
  }
);

module.exports = QRPass;
