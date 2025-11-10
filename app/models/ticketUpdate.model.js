module.exports = (sequelize, Sequelize) => {
  const TicketUpdate = sequelize.define('TicketUpdate', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    type: {
      type: Sequelize.ENUM('response', 'status_change', 'creation', 'closure'),
      allowNull: false,
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
  }, {
    tableName: 'TicketUpdate',
    timestamps: false,
  });

  TicketUpdate.associate = (models) => {
    // Cada atualização pertence a um ticket
    TicketUpdate.belongsTo(models.Ticket, {
      foreignKey: 'ticket_id',
      as: 'ticket',
    });

    // Cada atualização pode ter um employee (se for resposta)
    TicketUpdate.belongsTo(models.Employee, {
      foreignKey: 'employee_id',
      as: 'employee',
      allowNull: true,
    });
  };

  return TicketUpdate;
};