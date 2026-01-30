const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("MySQL Connected");

    await sequelize.sync();
    console.log("Tables Synced");
  } catch (err) {
    console.error("❌ DB Error:", err.message);
  }
};

module.exports = { sequelize, connectDB };
