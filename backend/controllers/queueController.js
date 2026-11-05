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

module.exports = {
  createQueue,
  getQueues,
  getQueueById,
};