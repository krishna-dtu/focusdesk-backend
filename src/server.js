require("dotenv").config();

const app = require("./app");
const { sequelize } = require("./config/db");

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL Connected");

    await sequelize.sync({ alter: true });
    console.log("✅ Database Synced");
  } catch (err) {
    console.error("❌ DB Error:", err.message);
  }
};

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
