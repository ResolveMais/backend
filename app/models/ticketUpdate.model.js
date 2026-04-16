const initTicketUpdateModel = (sequelize, Sequelize) => {
  const TicketUpdate = sequelize.define(
    "TicketUpdate",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING(40),
        allowNull: false,
},
      actorUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: "actor_user_id",
      },
      statusFrom: {
        type: Sequelize.STRING(30),
        allowNull: true,
        field: "status_from",
      },
      statusTo: {
        type: Sequelize.STRING(30),
        allowNull: true,
        field: "status_to",
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: "TicketUpdate",
      timestamps: false,
    }
  );

  TicketUpdate.associate = (models) => {
    TicketUpdate.belongsTo(models.Ticket, {
      foreignKey: "ticket_id",
      as: "ticket",
    });

    TicketUpdate.belongsTo(models.Employee, {
      foreignKey: "employee_id",
      as: "employee",
      allowNull: true,
    });

    TicketUpdate.belongsTo(models.User, {
      foreignKey: "actor_user_id",
      as: "actor",
      allowNull: true,
    });
  };

  return TicketUpdate;
};

export default initTicketUpdateModel;
