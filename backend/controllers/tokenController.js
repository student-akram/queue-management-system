const { sequelize, Queue, Token } = require("../models");

// ADD PERSON TO QUEUE
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

    // Get current waiting count for position
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
    await transaction.rollback();

    console.error("Add token error:", error);

    return res.status(500).json({
      message: "Server error while adding token",
    });
  }
};

module.exports = {
  addToken,
};