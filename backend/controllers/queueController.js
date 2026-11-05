const { Queue, Token } = require("../models");

// CREATE QUEUE
const createQueue = async (req, res) => {
  try {
    const { name } = req.body;
    const managerId = req.manager.managerId;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Queue name is required",
      });
    }

    const queue = await Queue.create({
      name: name.trim(),
      managerId,
    });

    return res.status(201).json({
      message: "Queue created successfully",
      queue,
    });
  } catch (error) {
    console.error("Create queue error:", error);

    return res.status(500).json({
      message: "Server error while creating queue",
    });
  }
};

// GET ALL QUEUES FOR LOGGED-IN MANAGER
const getQueues = async (req, res) => {
  try {
    const managerId = req.manager.managerId;

    const queues = await Queue.findAll({
      where: { managerId },
      include: [
        {
          model: Token,
          attributes: ["id", "tokenNumber", "personName", "position", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      queues,
    });
  } catch (error) {
    console.error("Get queues error:", error);

    return res.status(500).json({
      message: "Server error while fetching queues",
    });
  }
};

// GET ONE QUEUE WITH TOKENS
const getQueueById = async (req, res) => {
  try {
    const managerId = req.manager.managerId;
    const { id } = req.params;

    const queue = await Queue.findOne({
      where: {
        id,
        managerId,
      },
      include: [
        {
          model: Token,
          attributes: [
            "id",
            "tokenNumber",
            "personName",
            "position",
            "status",
            "createdAt",
            "serviceStartedAt",
            "serviceCompletedAt",
          ],
        },
      ],
    });

    if (!queue) {
      return res.status(404).json({
        message: "Queue not found",
      });
    }

    return res.status(200).json({
      queue,
    });
  } catch (error) {
    console.error("Get queue error:", error);

    return res.status(500).json({
      message: "Server error while fetching queue",
    });
  }
};
// ========================================
// GET QUEUE ANALYTICS
// GET /api/queues/:queueId/analytics
// ========================================
const getQueueAnalytics = async (req, res) => {
  try {
    const { queueId } = req.params;
    const managerId = req.manager.managerId;

    // Verify queue belongs to logged-in manager
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

    // Fetch all tokens for this queue
    const tokens = await Token.findAll({
      where: {
        queueId: queue.id,
      },
      attributes: [
        "id",
        "tokenNumber",
        "personName",
        "status",
        "createdAt",
        "serviceStartedAt",
        "serviceCompletedAt",
        "cancelledAt",
      ],
    });

    // Calculate status counts
    const totalTokens = tokens.length;

    const waitingTokens = tokens.filter(
      (token) => token.status === "WAITING"
    );

    const servingTokens = tokens.filter(
      (token) => token.status === "SERVING"
    );

    const completedTokens = tokens.filter(
      (token) => token.status === "COMPLETED"
    );

    const cancelledTokens = tokens.filter(
      (token) => token.status === "CANCELLED"
    );

    // Calculate average waiting time
    // Waiting time = service start time - token creation time
    const waitingTimes = completedTokens
      .filter(
        (token) => token.createdAt && token.serviceStartedAt
      )
      .map((token) => {
        const waitingMilliseconds =
          new Date(token.serviceStartedAt).getTime() -
          new Date(token.createdAt).getTime();

        return waitingMilliseconds / 60000;
      })
      .filter((minutes) => minutes >= 0);

    const averageWaitingTime =
      waitingTimes.length > 0
        ? waitingTimes.reduce((sum, minutes) => sum + minutes, 0) /
          waitingTimes.length
        : 0;

    // Calculate average service time
    // Service time = completion time - service start time
    const serviceTimes = completedTokens
      .filter(
        (token) =>
          token.serviceStartedAt && token.serviceCompletedAt
      )
      .map((token) => {
        const serviceMilliseconds =
          new Date(token.serviceCompletedAt).getTime() -
          new Date(token.serviceStartedAt).getTime();

        return serviceMilliseconds / 60000;
      })
      .filter((minutes) => minutes >= 0);

    const averageServiceTime =
      serviceTimes.length > 0
        ? serviceTimes.reduce((sum, minutes) => sum + minutes, 0) /
          serviceTimes.length
        : 0;

    return res.status(200).json({
      message: "Queue analytics fetched successfully",

      queue: {
        id: queue.id,
        name: queue.name,
      },

      summary: {
        totalTokens,
        waiting: waitingTokens.length,
        serving: servingTokens.length,
        completed: completedTokens.length,
        cancelled: cancelledTokens.length,
      },

      averageWaitingTimeMinutes: Number(
        averageWaitingTime.toFixed(2)
      ),

      averageServiceTimeMinutes: Number(
        averageServiceTime.toFixed(2)
      ),
    });
  } catch (error) {
    console.error("Queue analytics error:", error);

    return res.status(500).json({
      message: "Server error while fetching queue analytics",
    });
  }
};

module.exports = {
  createQueue,
  getQueues,
  getQueueById,
  getQueueAnalytics,
};