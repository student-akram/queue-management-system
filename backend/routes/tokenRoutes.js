const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { moveToken } = require("../controllers/tokenController");

// All token management routes require authentication
router.use(authMiddleware);

// Move token up or down
router.patch("/:tokenId/move", moveToken);

module.exports = router;