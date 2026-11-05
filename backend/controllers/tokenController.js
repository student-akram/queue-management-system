const { sequelize, Queue, Token } = require("../models");
const { Op } = require("sequelize");

// =====================================================
// HELPER: Normalize waiting token positions
// Waiting tokens will always have positions 1, 2, 3...
// =====================================================
const normalizeWaitingPositions = async (queueId, transaction) => {
  const waitingTokens = await Token.findAll({
    where: {
      queueId,
      status: "WAITING",
    },
    order: [
      ["position", "ASC"],
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  // First move them to temporary unique negative positions
  for (let i = 0; i < waitingTokens.length; i++) {
    await waitingTokens[i].update(
      { position: -(100000 + i) },
      { transaction }
    );
  }

  // Then assign proper positions: 1, 2, 3...
  for (let i = 0; i < waitingTokens.length; i++) {
    await waitingTokens[i].update(
      { position: i + 1 },
      { transaction }
    );
  }

  return waitingTokens;
};

// =====================================================
// ADD PERSON TO QUEUE
// POST /api/queues/:queueId/tokens
// =====================================================
const addToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { personName } = req.body;
    const { queueId } = req.params;
    const managerId = req.manager.managerId;

    if (!personName || !personName.trim()) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Person name is required",
      });
    }

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

    // Repair existing waiting positions before adding a new token
    const waitingCount = await Token.count({
      where: {
        queueId: queue.id,
        status: "WAITING",
      },
      transaction,
    });

    const number = queue.nextTokenNumber;
    const tokenNumber = `T${String(number).padStart(3, "0")}`;

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

// =====================================================
// GET ALL TOKENS FOR A QUEUE
// GET /api/queues/:queueId/tokens
// =====================================================
const getQueueTokens = async (req, res) => {
  try {
    const { queueId } = req.params;
    const managerId = req.manager.managerId;

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

    const tokens = await Token.findAll({
      where: {
        queueId: queue.id,
      },
      order: [
        ["position", "ASC"],
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
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
      queueId: queue.id,
      tokens,
    });
  } catch (error) {
    console.error("Get queue tokens error:", error);

    return res.status(500).json({
      message: "Unable to fetch queue tokens",
    });
  }
};

// =====================================================
// MOVE TOKEN UP OR DOWN
// PATCH /api/tokens/:tokenId/move
// =====================================================
const moveToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { tokenId } = req.params;
    const { direction } = req.body;
    const managerId = req.manager.managerId;

    if (!["up", "down"].includes(direction)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Direction must be either 'up' or 'down'",
      });
    }

    // Find token
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
      lock: transaction.LOCK.UPDATE,
    });

    if (!queue) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Queue not found",
      });
    }

    if (token.status !== "WAITING") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Only waiting tokens can be moved",
      });
    }

    // Repair invalid positions such as -1 before moving
    await normalizeWaitingPositions(queue.id, transaction);

    // Fetch waiting tokens in their corrected order
    const waitingTokens = await Token.findAll({
      where: {
        queueId: queue.id,
        status: "WAITING",
      },
      order: [["position", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const currentIndex = waitingTokens.findIndex(
      (item) => Number(item.id) === Number(token.id)
    );

    if (currentIndex === -1) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Waiting token not found in queue",
      });
    }

    const targetIndex =
      direction === "up"
        ? currentIndex - 1
        : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= waitingTokens.length) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          direction === "up"
            ? "Token is already at the top of the waiting list"
            : "Token is already at the bottom of the waiting list",
      });
    }

    const currentToken = waitingTokens[currentIndex];
    const adjacentToken = waitingTokens[targetIndex];

    // IMPORTANT: Store original positions before updating
    const currentPosition = Number(currentToken.position);
    const adjacentPosition = Number(adjacentToken.position);

    // Use a temporary position that cannot conflict with existing positions
    const temporaryPosition = -999999;

    await currentToken.update(
      { position: temporaryPosition },
      { transaction }
    );

    await adjacentToken.update(
      { position: currentPosition },
      { transaction }
    );

    await currentToken.update(
      { position: adjacentPosition },
      { transaction }
    );

    // Ensure all waiting positions are sequential
    await normalizeWaitingPositions(queue.id, transaction);

    await transaction.commit();

    return res.status(200).json({
      message: `Token moved ${direction} successfully`,
      token: {
        id: currentToken.id,
        tokenNumber: currentToken.tokenNumber,
        personName: currentToken.personName,
        position: currentToken.position,
        status: currentToken.status,
      },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Move token error:", error);

    return res.status(500).json({
      message: "Server error while moving token",
      error: error.message,
    });
  }
};

// =====================================================
// CALL NEXT TOKEN
// POST /api/queues/:queueId/call-next
// =====================================================
const callNextToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { queueId } = req.params;
    const managerId = req.manager.managerId;

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
        message:
          "Complete the current serving token before calling the next person",
        servingToken: {
          id: servingToken.id,
          tokenNumber: servingToken.tokenNumber,
          personName: servingToken.personName,
        },
      });
    }

    // Repair positions before selecting the next token
    await normalizeWaitingPositions(queue.id, transaction);

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

    await nextToken.update(
      {
        status: "SERVING",
        serviceStartedAt: new Date(),
      },
      { transaction }
    );

    // Normalize remaining waiting tokens
    await normalizeWaitingPositions(queue.id, transaction);

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

// =====================================================
// COMPLETE SERVICE
// PATCH /api/tokens/:tokenId/complete
// =====================================================
const completeToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { tokenId } = req.params;
    const managerId = req.manager.managerId;

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

    if (token.status !== "SERVING") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Only a serving token can be completed",
      });
    }

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

// =====================================================
// CANCEL TOKEN
// PATCH /api/tokens/:tokenId/cancel
// =====================================================
const cancelToken = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { tokenId } = req.params;
    const managerId = req.manager.managerId;

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

    if (token.status !== "WAITING") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Only waiting tokens can be cancelled",
      });
    }

    await token.update(
      {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
      { transaction }
    );

    // Normalize remaining waiting tokens
    await normalizeWaitingPositions(queue.id, transaction);

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

// =====================================================
// EXPORT CONTROLLER FUNCTIONS
// =====================================================
module.exports = {
  addToken,
  getQueueTokens,
  moveToken,
  callNextToken,
  completeToken,
  cancelToken,
};