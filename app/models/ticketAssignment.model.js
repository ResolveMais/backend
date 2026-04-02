const initTicketAssignmentModel = (sequelize, Sequelize) => {
  const TicketAssignment = sequelize.define(
    "TicketAssignment",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      assignedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      closedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "TicketAssignment",
      timestamps: false,
    }
  );

  TicketAssignment.associate = (models) => {
    TicketAssignment.belongsTo(models.Employee, {
      foreignKey: "employee_id",
      as: "employee",
    });

    TicketAssignment.belongsTo(models.Ticket, {
      foreignKey: "ticket_id",
      as: "ticket",
    });
  };

  return TicketAssignment;
};

export default initTicketAssignmentModel;
