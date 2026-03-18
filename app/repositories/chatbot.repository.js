const {
  ChatConversation,
  ChatMessage,
  sequelize,
} = require("../models");

const ACTIVE_CONVERSATION_WHERE = { del: false };

module.exports = {
  getConversationByIdForUser: async ({ conversationId, userId }) => {
    return ChatConversation.findOne({
      where: {
        id: conversationId,
        user_id: userId,
        ...ACTIVE_CONVERSATION_WHERE,
      },
    });
  },

  getActiveConversationByUserId: async (userId) => {
    return ChatConversation.findOne({
      where: {
        user_id: userId,
        ...ACTIVE_CONVERSATION_WHERE,
      },
      order: [["createdAt", "DESC"]],
    });
  },

  createConversation: async ({ userId }) => {
    return ChatConversation.create({
      user_id: userId,
    });
  },

  getMessagesByConversationId: async ({
    conversationId,
    limit = null,
    order = "ASC",
  }) => {
    const query = {
      where: {
        conversation_id: conversationId,
        del: false,
      },
      order: [["createdAt", order]],
    };

    if (Number.isInteger(limit) && limit > 0) {
      query.limit = limit;
    }

    return ChatMessage.findAll(query);
  },

  createMessage: async ({ conversationId, role, content }) => {
    const createdMessage = await ChatMessage.create({
      conversation_id: conversationId,
      role,
      content,
    });

    await ChatConversation.update(
      { updatedAt: new Date() },
      {
        where: { id: conversationId },
      }
    );

    return createdMessage;
  },

  softDeleteConversation: async ({ conversationId, userId }) => {
    const transaction = await sequelize.transaction();

    try {
      const deletedAt = new Date();

      await ChatMessage.update(
        {
          del: true,
          deletedAt,
        },
        {
          where: {
            conversation_id: conversationId,
            del: false,
          },
          transaction,
        }
      );

      const [updatedRowsCount] = await ChatConversation.update(
        {
          del: true,
          deletedAt,
          updatedAt: deletedAt,
        },
        {
          where: {
            id: conversationId,
            user_id: userId,
            del: false,
          },
          transaction,
        }
      );

      await transaction.commit();
      return updatedRowsCount > 0;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
