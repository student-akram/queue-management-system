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
  callNextToken
} = require("../controllers/tokenController");

// All queue routes require manager authentication
router.use(authMiddleware);

router.post("/", createQueue);
router.get("/", getQueues);
router.get("/:id", getQueueById);

router.post("/:queueId/tokens", addToken);
router.get("/:queueId/tokens", getQueueTokens);
router.post("/:queueId/call-next", callNextToken);

module.exports = router;