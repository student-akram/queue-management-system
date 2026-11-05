const sequelize = require("../config/database");

const Manager = require("./Manager");
const Queue = require("./Queue");
const Token = require("./Token");

// One Manager → Many Queues
Manager.hasMany(Queue, {
  foreignKey: "managerId",
  onDelete: "CASCADE",
});

Queue.belongsTo(Manager, {
  foreignKey: "managerId",
});

// One Queue → Many Tokens
Queue.hasMany(Token, {
  foreignKey: "queueId",
  onDelete: "CASCADE",
});

Token.belongsTo(Queue, {
  foreignKey: "queueId",
});

module.exports = {
  sequelize,
  Manager,
  Queue,
  Token,
};