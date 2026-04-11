const knex = require('knex');
const config = require('../knexfile');

const env = process.env.NODE_ENV || 'development';
const instance = knex(config[env]);

module.exports = instance;
