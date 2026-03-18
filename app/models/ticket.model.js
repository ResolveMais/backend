module.exports = (sequelize, Sequelize) => {
  const Ticket = sequelize.define('Ticket', {
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
      defaultValue: 'aberto',
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
    // ✅ NOVO CAMPO: Para rastrear última atualização
    updatedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
    // ✅ NOVO CAMPO: Para mensagens de atualização
    lastUpdateMessage: {
      type: Sequelize.STRING,
      allowNull: true,
    }
  }, {
    tableName: 'Ticket',
    timestamps: false,
  });

  Ticket.associate = (models) => {
    // Cada ticket pertence a um cliente
    Ticket.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'cliente',
    });

    // Cada ticket pertence a uma empresa
    Ticket.belongsTo(models.Company, {
      foreignKey: 'company_id',
      as: 'empresa',
    });

    // Cada ticket está vinculado a um título padrão de reclamação
    Ticket.belongsTo(models.ComplaintTitle, {
      foreignKey: 'complaintTitle_id',
      as: 'tituloReclamacao',
    });

    // Um ticket pode ter várias atualizações
    Ticket.hasMany(models.TicketUpdate, {
      foreignKey: 'ticket_id',
      as: 'updates',
    });

    // Um ticket pode ter várias conversas do chatbot
    Ticket.hasMany(models.ChatConversation, {
      foreignKey: 'ticket_id',
      as: 'chatConversations',
    });
  };

  return Ticket;
};
