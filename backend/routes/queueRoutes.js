const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createQueue,
  getQueues,
  getQueueById,
} = require("../controllers/queueController");

const { addToken } = require("../controllers/tokenController");

// All queue routes require authentication
router.use(authMiddleware);

router.post("/", createQueue);
router.get("/", getQueues);
router.get("/:id", getQueueById);

// Add a person to a specific queue
router.post("/:queueId/tokens", addToken);

module.exports = router;