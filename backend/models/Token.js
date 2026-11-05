const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Token = sequelize.define(
  "Token",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    tokenNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    personName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "WAITING",
        "SERVING",
        "COMPLETED",
        "CANCELLED"
      ),
      allowNull: false,
      defaultValue: "WAITING",
    },

    queueId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    serviceStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    serviceCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tokens",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["queueId", "tokenNumber"],
      },
    ],
  }
);

module.exports = Token;