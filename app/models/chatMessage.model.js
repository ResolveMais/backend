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
        type: Sequelize.ENUM("user", "assistant", "system"),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
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
  };

  return ChatMessage;
};

export default initChatMessageModel;
