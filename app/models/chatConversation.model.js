const initChatConversationModel = (sequelize, Sequelize) => {
  const ChatConversation = sequelize.define(
    "ChatConversation",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      del: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: "ChatConversation",
      timestamps: false,
      indexes: [
        {
          fields: ["user_id", "ticket_id", "del", "createdAt"],
        },
      ],
    }
  );

  ChatConversation.associate = (models) => {
    ChatConversation.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });

    ChatConversation.belongsTo(models.Ticket, {
      foreignKey: "ticket_id",
      as: "ticket",
    });

    ChatConversation.hasMany(models.ChatMessage, {
      foreignKey: "conversation_id",
      as: "messages",
    });
  };

  return ChatConversation;
};

export default initChatConversationModel;
