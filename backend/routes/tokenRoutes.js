const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { moveToken,completeToken,cancelToken } = require("../controllers/tokenController");

// All token management routes require authentication
router.use(authMiddleware);

// Move token up or down
router.patch("/:tokenId/move", moveToken);
router.patch("/:tokenId/complete", completeToken);
router.patch("/:tokenId/cancel", cancelToken);

module.exports = router;