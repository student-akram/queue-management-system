const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createQueue,
  getQueues,
  getQueueById,
} = require("../controllers/queueController");

const {
  addToken,
  getQueueTokens,
} = require("../controllers/tokenController");

// All queue routes require manager authentication
router.use(authMiddleware);

// Queue APIs
router.post("/", createQueue);
router.get("/", getQueues);
router.get("/:id", getQueueById);

// Token APIs
router.post("/:queueId/tokens", addToken);
router.get("/:queueId/tokens", getQueueTokens);

module.exports = router;