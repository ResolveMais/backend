import {
  ChatConversation,
  ChatMessage,
  sequelize,
} from "../models/index.js";

const ACTIVE_CONVERSATION_WHERE = { del: false };

const getConversationByIdForUser = async ({
  conversationId,
  userId,
  ticketId = null,
}) => {
  const whereClause = {
    id: conversationId,
    user_id: userId,
    ...ACTIVE_CONVERSATION_WHERE,
  };

  if (ticketId) {
    whereClause.ticket_id = ticketId;
  }

  return ChatConversation.findOne({ where: whereClause });
};

const getActiveConversationByUserId = async (userId) =>
  ChatConversation.findOne({
    where: {
      user_id: userId,
      ticket_id: null,
      ...ACTIVE_CONVERSATION_WHERE,
    },
    order: [["createdAt", "DESC"]],
  });

const getActiveConversationByUserAndTicketId = async ({ userId, ticketId }) =>
  ChatConversation.findOne({
    where: {
      user_id: userId,
      ticket_id: ticketId,
      ...ACTIVE_CONVERSATION_WHERE,
    },
    order: [["createdAt", "DESC"]],
  });

const createConversation = async ({ userId, ticketId = null }) =>
  ChatConversation.create({
    user_id: userId,
    ticket_id: ticketId,
  });

const getMessagesByConversationId = async ({
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
};

const createMessage = async ({ conversationId, role, content }) => {
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
};

const softDeleteConversation = async ({ conversationId, userId }) => {
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
};

export {
  createConversation,
  createMessage,
  getActiveConversationByUserAndTicketId,
  getActiveConversationByUserId,
  getConversationByIdForUser,
  getMessagesByConversationId,
  softDeleteConversation,
};

export default {
  getConversationByIdForUser,
  getActiveConversationByUserId,
  getActiveConversationByUserAndTicketId,
  createConversation,
  getMessagesByConversationId,
  createMessage,
  softDeleteConversation,
};
