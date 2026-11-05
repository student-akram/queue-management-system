const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.TIDB_DATABASE,
  process.env.TIDB_USER,
  process.env.TIDB_PASSWORD,
  {
    host: process.env.TIDB_HOST,
    port: Number(process.env.TIDB_PORT || 4000),
    dialect: "mysql",

    dialectOptions: {
      ssl:
        process.env.TIDB_ENABLE_SSL === "true"
          ? {
              minVersion: "TLSv1.2",
              rejectUnauthorized: true,
            }
          : undefined,
    },

    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

module.exports = sequelize;