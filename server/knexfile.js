require('dotenv').config();
const path = require('path');

module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(__dirname, process.env.DB_PATH || '../storage/fresco.db'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: './db/migrations',
    },
    seeds: {
      directory: './db/seeds',
    },
  },
  production: {
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(__dirname, process.env.DB_PATH || '../storage/fresco.db'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: './db/migrations',
    },
    seeds: {
      directory: './db/seeds',
    },
  },
};
