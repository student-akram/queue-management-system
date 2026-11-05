const { sequelize, Queue, Token } = require("../models");

// ========================================
// ADD PERSON TO QUEUE
// POST /api/queues/:queueId/tokens
// ========================================
const addToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { personName } = req.body;
    const { queueId } = req.params;
    const managerId = req.manager.managerId;

    // Validate person name
    if (!personName || !personName.trim()) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Person name is required",
      });
    }

    // Find queue owned by this manager and lock it
    const queue = await Queue.findOne({
      where: {
        id: queueId,
        managerId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!queue) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Queue not found",
      });
    }

    // Generate token number
    const number = queue.nextTokenNumber;
    const tokenNumber = `T${String(number).padStart(3, "0")}`;

    // Get current waiting count
    const waitingCount = await Token.count({
      where: {
        queueId: queue.id,
        status: "WAITING",
      },
      transaction,
    });

    // Create token
    const token = await Token.create(
      {
        tokenNumber,
        personName: personName.trim(),
        position: waitingCount + 1,
        status: "WAITING",
        queueId: queue.id,
      },
      { transaction }
    );

    // Increment next token number
    await queue.update(
      {
        nextTokenNumber: number + 1,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      message: "Token created successfully",
      token,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Add token error:", error);

    return res.status(500).json({
      message: "Server error while adding token",
    });
  }
};

// ========================================
// GET ALL TOKENS FOR A QUEUE
// GET /api/queues/:queueId/tokens
// ========================================
const getQueueTokens = async (req, res) => {
  try {
    const { queueId } = req.params;
    const managerId = req.manager.managerId;

    // Check that queue belongs to logged-in manager
    const queue = await Queue.findOne({
      where: {
        id: queueId,
        managerId,
      },
    });

    if (!queue) {
      return res.status(404).json({
        message: "Queue not found",
      });
    }

    // Fetch tokens in position order
    const tokens = await Token.findAll({
      where: {
        queueId: queue.id,
      },
      order: [["position", "ASC"]],
      attributes: [
        "id",
        "tokenNumber",
        "personName",
        "position",
        "status",
        "createdAt",
        "serviceStartedAt",
        "serviceCompletedAt",
        "cancelledAt",
      ],
    });

    return res.status(200).json({
      message: "Queue tokens fetched successfully",
      queue: {
        id: queue.id,
        name: queue.name,
      },
      totalTokens: tokens.length,
      tokens,
    });
  } catch (error) {
    console.error("Get queue tokens error:", error);

    return res.status(500).json({
      message: "Server error while fetching queue tokens",
    });
  }
};
// ========================================
// MOVE TOKEN UP OR DOWN
// PATCH /api/tokens/:tokenId/move
// ========================================
const moveToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { tokenId } = req.params;
    const { direction } = req.body;
    const managerId = req.manager.managerId;

    // Validate direction
    if (!["up", "down"].includes(direction)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Direction must be either 'up' or 'down'",
      });
    }

    // Find token and its queue
    const token = await Token.findByPk(tokenId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!token) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Token not found",
      });
    }

    // Verify queue belongs to logged-in manager
    const queue = await Queue.findOne({
      where: {
        id: token.queueId,
        managerId,
      },
      transaction,
    });

    if (!queue) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Queue not found",
      });
    }

    // Only waiting tokens can be moved
    if (token.status !== "WAITING") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Only waiting tokens can be moved",
      });
    }

    // Get all waiting tokens in their current order
    const waitingTokens = await Token.findAll({
      where: {
        queueId: token.queueId,
        status: "WAITING",
      },
      order: [["position", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const currentIndex = waitingTokens.findIndex(
      (item) => item.id === token.id
    );

    // Determine adjacent token index
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    // Prevent moving beyond queue boundaries
    if (targetIndex < 0 || targetIndex >= waitingTokens.length) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          direction === "up"
            ? "Token is already at the top of the waiting list"
            : "Token is already at the bottom of the waiting list",
      });
    }

    const adjacentToken = waitingTokens[targetIndex];

    // Swap positions using a temporary position to avoid collisions
    const temporaryPosition = -1;

    await token.update(
      { position: temporaryPosition },
      { transaction }
    );

    await adjacentToken.update(
      { position: token.position },
      { transaction }
    );

    await token.update(
      { position: adjacentToken.position },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      message: `Token moved ${direction} successfully`,
      token: {
        id: token.id,
        tokenNumber: token.tokenNumber,
        personName: token.personName,
        position: token.position,
        status: token.status,
      },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Move token error:", error);

    return res.status(500).json({
      message: "Server error while moving token",
    });
  }
};
// ========================================
// EXPORT CONTROLLER FUNCTIONS
// ========================================
module.exports = {
  addToken,
  getQueueTokens,
  moveToken,
};