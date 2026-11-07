
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const guidelineRoutes = require("./routes/guidelineRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const findingRoutes = require("./routes/findingRoutes");
// Authentication middleware
const { protect } = require("./middleware/authMiddleware");

// Guideline download controller
const {
  downloadGuidelineFile
} = require("./controllers/guidelineController");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BrandGuard AI Backend is running!"
  });
});

// Authentication APIs
app.use("/api/auth", authRoutes);

// User management APIs
app.use("/api/users", userRoutes);

// Guidelines APIs
app.use("/api/guidelines", guidelineRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/findings", findingRoutes);
// Guideline document download API
app.get(
  "/api/files/:fileId",
  protect,
  downloadGuidelineFile
);

// Server configuration
const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log("MongoDB connected successfully!");
      console.log(`BrandGuard AI Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
