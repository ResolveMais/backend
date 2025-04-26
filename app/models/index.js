const dbConfig = require('../config/db.config.js');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
    port: dbConfig.PORT,
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    operatorsAliases: 0,
    timezone: '-03:00',
    logging: false,
    pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle,
    },
});

sequelize
    .authenticate()
    .then(() => {
        console.log('Connection has been established successfully.');
        sequelize.sync();
    }).catch((err) => {
        console.log('Database connection is not working!', err);
    });

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.Company = require('./company.model.js')(sequelize, Sequelize);

module.exports = db;