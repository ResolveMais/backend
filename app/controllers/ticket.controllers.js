module.exports = (sequelize, Sequelize) => {
const Ticket = sequelize.define(`ticket`, {
    id: {
        type: Sequelize.INTEGER,
        primaryKEY: true,
        autoIncrement: true,
    },
    title: {
        type: Sequelize.STRING,
        allowNULL: false,
    },
    description: {
        type: Sequelize.TEXT,
        allowNULL: false,
    },
    status: {
        type: Sequelize.ENUM(`open`, `in_progress`, `resolved`, `closed`),
        defaultValue: `open`,
    },
    priority: {
        type: Sequelize.ENUM(`low`, `medium`, Highlight, `critical`),
        defaultValue: `medium`,
    },
});

return Ticket;

}