const dbConfig = require("../config/db.config.js");
const fs = require("fs");
const path = require("path");
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    port: dbConfig.PORT,
    logging: false,
    dialectOptions: {
        options: {
            encrypt: false,
            trustServerCertificate: true,
        },
    },
});

sequelize
    .authenticate()
    .then(() => {
        console.log("Connection has been established successfully.");
        sequelize.sync();
    }).catch((err) => {
        console.log("Database connection is not working!", err);
    });

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

fs.readdirSync(__dirname)
    .filter((file) => {
        return (
            file.indexOf(".") !== 0 &&
            file !== "index.js" &&
            file.slice(-3) === ".js" &&
            file.indexOf(".test.js") === -1
        );
    })
    .forEach((file) => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

module.exports = db;