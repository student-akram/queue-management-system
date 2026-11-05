const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Queue = sequelize.define(
  "Queue",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    nextTokenNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    managerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "queues",
    timestamps: true,
  }
);

module.exports = Queue;