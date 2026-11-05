const { sequelize, Queue, Token, } = require("../models");
const{Op}=require("sequelize");

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
// CALL NEXT TOKEN
// POST /api/queues/:queueId/call-next
// ========================================
const callNextToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { queueId } = req.params;
    const managerId = req.manager.managerId;

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

    // Check if another token is already being served
    const servingToken = await Token.findOne({
      where: {
        queueId: queue.id,
        status: "SERVING",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (servingToken) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Complete the current serving token before calling the next person",
        servingToken: {
          id: servingToken.id,
          tokenNumber: servingToken.tokenNumber,
          personName: servingToken.personName,
        },
      });
    }

    // Find the first waiting token
    const nextToken = await Token.findOne({
      where: {
        queueId: queue.id,
        status: "WAITING",
      },
      order: [["position", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!nextToken) {
      await transaction.rollback();

      return res.status(404).json({
        message: "No waiting tokens in this queue",
      });
    }

    // Mark token as serving
    await nextToken.update(
      {
        status: "SERVING",
        serviceStartedAt: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      message: "Next token called successfully",
      token: {
        id: nextToken.id,
        tokenNumber: nextToken.tokenNumber,
        personName: nextToken.personName,
        position: nextToken.position,
        status: nextToken.status,
        serviceStartedAt: nextToken.serviceStartedAt,
      },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Call next token error:", error);

    return res.status(500).json({
      message: "Server error while calling next token",
    });
  }
};

// ========================================
// COMPLETE SERVICE
// PATCH /api/tokens/:tokenId/complete
// ========================================
const completeToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { tokenId } = req.params;
    const managerId = req.manager.managerId;

    // Find token and lock it
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

    // Verify queue ownership
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

    // Only serving tokens can be completed
    if (token.status !== "SERVING") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Only a serving token can be completed",
      });
    }

    // Mark service as completed
    await token.update(
      {
        status: "COMPLETED",
        serviceCompletedAt: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      message: "Service completed successfully",
      token: {
        id: token.id,
        tokenNumber: token.tokenNumber,
        personName: token.personName,
        status: token.status,
        serviceStartedAt: token.serviceStartedAt,
        serviceCompletedAt: token.serviceCompletedAt,
      },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Complete token error:", error);

    return res.status(500).json({
      message: "Server error while completing service",
    });
  }
};
// ========================================
// CANCEL TOKEN
// PATCH /api/tokens/:tokenId/cancel
// ========================================
const cancelToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { tokenId } = req.params;
    const managerId = req.manager.managerId;

    // Find token and lock it
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
      lock: transaction.LOCK.UPDATE,
    });

    if (!queue) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Queue not found",
      });
    }

    // Only waiting tokens can be cancelled
    if (token.status !== "WAITING") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Only waiting tokens can be cancelled",
      });
    }

    const cancelledPosition = token.position;

    // Mark token as cancelled
    await token.update(
      {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
      { transaction }
    );

    // Get remaining waiting tokens after the cancelled position
    const remainingTokens = await Token.findAll({
      where: {
        queueId: queue.id,
        status: "WAITING",
        position: {
          [Op.gt]: cancelledPosition,
        },
      },
      order: [["position", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // Shift remaining tokens one position up
    for (const waitingToken of remainingTokens) {
      await waitingToken.update(
        {
          position: waitingToken.position - 1,
        },
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(200).json({
      message: "Token cancelled successfully",
      token: {
        id: token.id,
        tokenNumber: token.tokenNumber,
        personName: token.personName,
        status: token.status,
        cancelledAt: token.cancelledAt,
      },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Cancel token error:", error);

    return res.status(500).json({
      message: "Server error while cancelling token",
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
  callNextToken,
  completeToken,
  cancelToken,
};