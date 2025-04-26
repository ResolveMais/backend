module.exports = (sequelize, Sequelize) => {
const User = sequelize.define(`user`, {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    role: {
        type: Sequelize.ENUM(`admin`, `agent`, `customer`),
        defaultValue: `customer`,
    },
    departamentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
});

return User;

};