import { Op } from "sequelize";
import { createRecordBySchema, filterAttributesBySchema, filterPayloadBySchema, hasColumnForAttribute } from "../utils/dbSchemaCompat.js";
import { CLOSED_TICKET_STATUSES, TICKET_MESSAGE_SENDER, TICKET_VIEWER_TYPE } from "../utils/ticketStatus.js";

import db from "../models/index.js";

const {
  ChatConversation,
  ChatMessage,
  Company,
  ComplaintTitle,
  Ticket,
  User,
  sequelize,
} = db;

const ACTIVE_CONVERSATION_WHERE = { del: false };

const chatMessageAttributes = [
  "id",
  "role",
  "content",
  "senderType",
  "senderName",
  "senderUserId",
  "messageType",
  "customerReadAt",
  "companyReadAt",
  "reminderSentAt",
  "createdAt",
];

const senderUserAttributes = ["id", "name", "email", "userType", "jobTitle"];
const ticketSummaryAttributes = [
  "id",
  "description",
  "status",
  "createdAt",
  "updatedAt",
  "assignedUserId",
];

const getChatMessageAttributes = async () =>
  filterAttributesBySchema(ChatMessage, chatMessageAttributes);

const getSenderUserAttributes = async () =>
  filterAttributesBySchema(User, senderUserAttributes);

const getTicketSummaryAttributes = async () =>
  filterAttributesBySchema(Ticket, ticketSummaryAttributes);

const refetchRecentMessage = async ({
  conversationId,
  role,
  content,
  createdAt,
  transaction = undefined,
}) =>
  ChatMessage.findOne({
    attributes: await getChatMessageAttributes(),
    where: {
      conversation_id: conversationId,
      role,
      content,
      createdAt: {
        [Op.gte]: new Date(createdAt.getTime() - 5000),
      },
      del: false,
    },
    order: [["id", "DESC"]],
    transaction,
  });

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

const getConversationByTicketId = async (ticketId) =>
  ChatConversation.findOne({
    where: {
      ticket_id: ticketId,
      ...ACTIVE_CONVERSATION_WHERE,
    },
    order: [["createdAt", "DESC"]],
  });

const createConversation = async ({ userId, ticketId = null }, options = {}) =>
  createRecordBySchema(
    ChatConversation,
    {
      user_id: userId,
      ticket_id: ticketId,
    },
    options
  );

const getOrCreateConversationByTicket = async ({
  ticketId,
  userId,
  transaction = undefined,
}) => {
  const existingConversation = await getConversationByTicketId(ticketId);

  if (existingConversation) return existingConversation;

  return createConversation(
    {
      userId,
      ticketId,
    },
    { transaction }
  );
};

const getMessagesByConversationId = async ({
  conversationId,
  limit = null,
  order = "ASC",
}) => {
  const attributes = await getChatMessageAttributes();
  const query = {
    attributes,
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

const listMessagesByTicketId = async (ticketId) => {
  const conversation = await getConversationByTicketId(ticketId);

  if (!conversation) {
    return {
      conversation: null,
      messages: [],
    };
  }

  const messages = await getMessagesByConversationId({
    conversationId: conversation.id,
    order: "ASC",
  });

  return {
    conversation,
    messages,
  };
};

const createMessage = async ({
  conversationId,
  role,
  content,
  senderType = null,
  senderName = null,
  senderUserId = null,
  messageType = "chat",
  customerReadAt = null,
  companyReadAt = null,
  reminderSentAt = null,
  transaction = undefined,
}) => {
  const now = new Date();
  const safePayload = await filterPayloadBySchema(ChatMessage, {
    conversation_id: conversationId,
    role,
    content,
    sender_type: senderType,
    sender_name: senderName,
    sender_user_id: senderUserId,
    message_type: messageType,
    customer_read_at: customerReadAt,
    company_read_at: companyReadAt,
    reminder_sent_at: reminderSentAt,
    createdAt: now,
  });
  let createdMessage = await createRecordBySchema(ChatMessage, safePayload, {
    transaction,
  });

  if (!createdMessage?.id) {
    createdMessage = await refetchRecentMessage({
      conversationId,
      role,
      content,
      createdAt: now,
      transaction,
    });
  }

  if (!createdMessage) {
    createdMessage = ChatMessage.build(
      {
        ...safePayload,
        createdAt: now,
      },
      { isNewRecord: false }
    );
  }

  await ChatConversation.update(
    { updatedAt: new Date() },
    {
      where: { id: conversationId },
      transaction,
    }
  );

  return createdMessage;
};

const markConversationMessagesAsRead = async ({
  conversationId,
  viewerType,
  transaction = undefined,
}) => {
  const hasCustomerReadAt = await hasColumnForAttribute(ChatMessage, "customerReadAt");
  const hasCompanyReadAt = await hasColumnForAttribute(ChatMessage, "companyReadAt");
  const hasSenderType = await hasColumnForAttribute(ChatMessage, "senderType");
  const readAtField =
    viewerType === TICKET_VIEWER_TYPE.CUSTOMER
      ? "customer_read_at"
      : "company_read_at";

  if (
    !hasSenderType ||
    (readAtField === "customer_read_at" && !hasCustomerReadAt) ||
    (readAtField === "company_read_at" && !hasCompanyReadAt)
  ) {
    return 0;
  }

  const senderTypeWhere =
    viewerType === TICKET_VIEWER_TYPE.CUSTOMER
      ? {
        sender_type: {
          [Op.in]: [
            TICKET_MESSAGE_SENDER.BOT,
            TICKET_MESSAGE_SENDER.EMPRESA,
            TICKET_MESSAGE_SENDER.FUNCIONARIO,
            TICKET_MESSAGE_SENDER.SISTEMA,
          ],
        },
      }
      : {
        sender_type: TICKET_MESSAGE_SENDER.CLIENTE,
      };

  const [updatedCount] = await ChatMessage.update(
    {
      [readAtField]: new Date(),
    },
    {
      where: {
        conversation_id: conversationId,
        del: false,
        [readAtField]: null,
        ...senderTypeWhere,
      },
      transaction,
    }
  );

  return updatedCount;
};

const markTicketMessagesAsRead = async ({
  ticketId,
  viewerType,
  transaction = undefined,
}) => {
  const conversation = await getConversationByTicketId(ticketId);

  if (!conversation) return 0;

  return markConversationMessagesAsRead({
    conversationId: conversation.id,
    viewerType,
    transaction,
  });
};

const listUnreadMessagesByTicketIds = async ({
  ticketIds,
  viewerType,
  limit = null,
}) => {
  const normalizedTicketIds = Array.from(
    new Set(
      (Array.isArray(ticketIds) ? ticketIds : [ticketIds])
        .map((ticketId) => Number(ticketId))
        .filter((ticketId) => Number.isInteger(ticketId) && ticketId > 0)
    )
  );

  if (normalizedTicketIds.length === 0) {
    return [];
  }

  const hasSenderType = await hasColumnForAttribute(ChatMessage, "senderType");
  const hasCustomerReadAt = await hasColumnForAttribute(ChatMessage, "customerReadAt");
  const hasCompanyReadAt = await hasColumnForAttribute(ChatMessage, "companyReadAt");
  const hasSenderUserId = await hasColumnForAttribute(ChatMessage, "senderUserId");
  const readAtField =
    viewerType === TICKET_VIEWER_TYPE.CUSTOMER
      ? "customer_read_at"
      : "company_read_at";

  if (
    !hasSenderType ||
    (readAtField === "customer_read_at" && !hasCustomerReadAt) ||
    (readAtField === "company_read_at" && !hasCompanyReadAt)
  ) {
    return [];
  }

  const senderTypeWhere =
    viewerType === TICKET_VIEWER_TYPE.CUSTOMER
      ? {
        sender_type: {
          [Op.in]: [
            TICKET_MESSAGE_SENDER.BOT,
            TICKET_MESSAGE_SENDER.EMPRESA,
            TICKET_MESSAGE_SENDER.FUNCIONARIO,
            TICKET_MESSAGE_SENDER.SISTEMA,
          ],
        },
      }
      : {
        sender_type: TICKET_MESSAGE_SENDER.CLIENTE,
      };

  const query = {
    attributes: await getChatMessageAttributes(),
    where: {
      del: false,
      [readAtField]: null,
      ...senderTypeWhere,
    },
    include: [
      {
        model: ChatConversation,
        as: "conversation",
        attributes: ["id", "ticket_id", "createdAt", "updatedAt"],
        required: true,
        where: {
          ...ACTIVE_CONVERSATION_WHERE,
          ticket_id: {
            [Op.in]: normalizedTicketIds,
          },
        },
      },
      ...(hasSenderUserId
        ? [
          {
            model: User,
            as: "senderUser",
            attributes: await getSenderUserAttributes(),
            required: false,
          },
        ]
        : []),
    ],
    order: [["createdAt", "DESC"]],
  };

  if (Number.isInteger(limit) && limit > 0) {
    query.limit = limit;
  }

  return ChatMessage.findAll(query);
};

const listMessagesPendingReminder = async ({ cutoffDate }) =>
  (async () => {
    const hasReminderSentAt = await hasColumnForAttribute(ChatMessage, "reminderSentAt");
    const hasSenderType = await hasColumnForAttribute(ChatMessage, "senderType");
    const hasCustomerReadAt = await hasColumnForAttribute(ChatMessage, "customerReadAt");
    const hasCompanyReadAt = await hasColumnForAttribute(ChatMessage, "companyReadAt");
    const hasSenderUserId = await hasColumnForAttribute(ChatMessage, "senderUserId");
    const hasAssignedUserId = await hasColumnForAttribute(Ticket, "assignedUserId");

    if (
      !hasReminderSentAt ||
      !hasSenderType ||
      !hasCustomerReadAt ||
      !hasCompanyReadAt
    ) {
      return [];
    }

    return ChatMessage.findAll({
      attributes: await getChatMessageAttributes(),
      where: {
        del: false,
        reminder_sent_at: null,
        createdAt: {
          [Op.lte]: cutoffDate,
        },
        [Op.or]: [
          {
            sender_type: TICKET_MESSAGE_SENDER.CLIENTE,
            company_read_at: null,
          },
          {
            sender_type: {
              [Op.in]: [
                TICKET_MESSAGE_SENDER.FUNCIONARIO,
                TICKET_MESSAGE_SENDER.EMPRESA,
              ],
            },
            customer_read_at: null,
          },
        ],
      },
      include: [
        {
          model: ChatConversation,
          as: "conversation",
          required: true,
          where: ACTIVE_CONVERSATION_WHERE,
          include: [
            {
              model: Ticket,
              as: "ticket",
              required: true,
              where: {
                status: {
                  [Op.notIn]: CLOSED_TICKET_STATUSES,
                },
              },
              attributes: await getTicketSummaryAttributes(),
              include: [
                {
                  model: User,
                  as: "cliente",
                  attributes: await filterAttributesBySchema(User, [
                    "id",
                    "name",
                    "email",
                    "phone",
                  ]),
                },
                ...(hasAssignedUserId
                  ? [
                    {
                      model: User,
                      as: "assignedEmployee",
                      attributes: await filterAttributesBySchema(User, [
                        "id",
                        "name",
                        "email",
                        "phone",
                        "jobTitle",
                      ]),
                      required: false,
                    },
                  ]
                  : []),
                {
                  model: Company,
                  as: "empresa",
                  attributes: ["id", "name"],
                },
                {
                  model: ComplaintTitle,
                  as: "tituloReclamacao",
                  attributes: ["id", "title"],
                },
              ],
            },
          ],
        },
        ...(hasSenderUserId
          ? [
            {
              model: User,
              as: "senderUser",
              attributes: await getSenderUserAttributes(),
              required: false,
            },
          ]
          : []),
      ],
      order: [["createdAt", "ASC"]],
    });
  })();

const markReminderSent = async ({
  messageId,
  reminderSentAt = new Date(),
  transaction = undefined,
}) => {
  const hasReminderSentAt = await hasColumnForAttribute(ChatMessage, "reminderSentAt");

  if (!hasReminderSentAt) {
    return false;
  }

  const [updatedCount] = await ChatMessage.update(
    {
      reminder_sent_at: reminderSentAt,
    },
    {
      where: { id: messageId },
      transaction,
    }
  );

  return updatedCount > 0;
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

export default {
  getConversationByIdForUser,
  getActiveConversationByUserId,
  getActiveConversationByUserAndTicketId,
  getConversationByTicketId,
  createConversation,
  getOrCreateConversationByTicket,
  getMessagesByConversationId,
  listMessagesByTicketId,
  listUnreadMessagesByTicketIds,
  createMessage,
  markConversationMessagesAsRead,
  markTicketMessagesAsRead,
  listMessagesPendingReminder,
  markReminderSent,
  softDeleteConversation,
};
