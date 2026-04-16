const initTicketModel = (sequelize, Sequelize) => {
  const Ticket = sequelize.define(
    "Ticket",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "aberto",
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      lastUpdateMessage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      assignedUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: "assigned_user_id",
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "accepted_at",
      },
      resolvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "resolved_at",
      },
      closedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "closed_at",
      },
      reopenedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "reopened_at",
      },
      lastInteractionAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "last_interaction_at",
      },
      autoClosedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "auto_closed_at",
      },
    },
    {
      tableName: "Ticket",
      timestamps: false,
    }
  );

  Ticket.associate = (models) => {
    Ticket.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "cliente",
    });

    Ticket.belongsTo(models.Company, {
      foreignKey: "company_id",
      as: "empresa",
    });

    Ticket.belongsTo(models.ComplaintTitle, {
      foreignKey: "complaintTitle_id",
      as: "tituloReclamacao",
    });

    Ticket.belongsTo(models.User, {
      foreignKey: "assigned_user_id",
      as: "assignedEmployee",
    });

    Ticket.hasMany(models.TicketUpdate, {
      foreignKey: "ticket_id",
      as: "updates",
    });

    Ticket.hasMany(models.ChatConversation, {
      foreignKey: "ticket_id",
      as: "chatConversations",
    });
  };

  return Ticket;
};

export default initTicketModel;
