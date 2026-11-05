const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const queueRoutes = require("./routes/queueRoutes");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Queue Management API is running",
  });
});
app.use("/api/auth",authRoutes);
app.use("/api/queues", queueRoutes);
module.exports = app;