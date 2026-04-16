const initChatMessageModel = (sequelize, Sequelize) => {
  const ChatMessage = sequelize.define(
    "ChatMessage",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      role: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      senderType: {
        type: Sequelize.STRING(30),
        allowNull: true,
        field: "sender_type",
      },
      senderName: {
        type: Sequelize.STRING(120),
        allowNull: true,
        field: "sender_name",
      },
      senderUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: "sender_user_id",
      },
      messageType: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "chat",
        field: "message_type",
      },
      customerReadAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "customer_read_at",
      },
      companyReadAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "company_read_at",
      },
      reminderSentAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: "reminder_sent_at",
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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: "ChatMessage",
      timestamps: false,
      indexes: [
        {
          fields: ["conversation_id", "del", "createdAt"],
        },
      ],
    }
  );

  ChatMessage.associate = (models) => {
    ChatMessage.belongsTo(models.ChatConversation, {
      foreignKey: "conversation_id",
      as: "conversation",
    });

    ChatMessage.belongsTo(models.User, {
      foreignKey: "sender_user_id",
      as: "senderUser",
    });
  };

  return ChatMessage;
};

export default initChatMessageModel;
