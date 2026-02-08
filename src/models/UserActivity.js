const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * UserActivity Model - Tracks daily activity for contribution calendar
 */
const UserActivity = sequelize.define("UserActivity", {
  requestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  date: {
    type: DataTypes.DATEONLY, // YYYY-MM-DD format
    allowNull: false,
  },

  checkInTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  checkOutTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  totalDuration: {
    type: DataTypes.INTEGER, // in minutes
    defaultValue: 0,
  },

  scanCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  isFlagged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  flagReason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ["requestId", "date"],
    },
  ],
});

module.exports = UserActivity;
