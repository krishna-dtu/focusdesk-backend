require("dotenv").config();

const app = require("./app");
const { sequelize } = require("./config/db");

// ✅ Import all models so Sequelize knows about them
require("./models/AccessRequest");
require("./models/QRPass");
require("./models/ScanLog");
require("./models/UserActivity");
require("./models/QRRotation");

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
