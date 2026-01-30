const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const gateRoutes = require("./routes/gateRoutes");
const hardwareRoutes = require("./routes/hardwareRoutes");

const app = express();

app.use(cors());

// ✅ MUST BE BEFORE ROUTES
app.use(express.json());

// Routes
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/gate", gateRoutes);

// ✅ Hardware endpoint
app.use("/", hardwareRoutes);
app.get("/", (req, res) => {
  res.send("✅ FocusDesk Backend Running");
});
module.exports = app;
