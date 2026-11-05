const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const queueRoutes = require("./routes/queueRoutes");
const tokenRoutes = require("./routes/tokenRoutes");
const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://your-frontend-name.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Queue Management API is running",
  });
});
app.use("/api/auth",authRoutes);
app.use("/api/queues", queueRoutes);
app.use("/api/tokens", tokenRoutes);
module.exports = app;