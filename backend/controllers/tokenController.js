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
// EXPORT CONTROLLER FUNCTIONS
// ========================================
module.exports = {
  addToken,
  getQueueTokens,
};