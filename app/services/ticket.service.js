import chatbotRepository from "../repositories/chatbot.repository.js";
import companyRepository from "../repositories/company.repository.js";
import ticketRepository from "../repositories/ticket.repository.js";
import userRepository from "../repositories/user.repository.js";
import { sendTicketPendingReplyEmail } from "../utils/mailer.js";
import { broadcastTicketEvent, hasViewerTypeConnected } from "../utils/ticketRealtime.js";
import {
  ACTIVE_TICKET_STATUSES,
  TICKET_LOG_TYPE,
  TICKET_MESSAGE_SENDER,
  TICKET_STATUS,
  TICKET_VIEWER_TYPE,
  isClosedTicketStatus,
  normalizeTicketStatus,
} from "../utils/ticketStatus.js";
import db from "../models/index.js";

const { sequelize } = db;

const USER_TYPES = Object.freeze({
  CLIENTE: "cliente",
  FUNCIONARIO: "funcionario",
  EMPRESA: "empresa",
});

const TICKET_RESOLUTION_SOURCE = Object.freeze({
  CHATBOT: "chatbot",
  HUMAN: "human",
});

const normalizeUserType = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const BOT_AGENT = Object.freeze({
  name: "Resolve Assist",
  description: "Assistente virtual responsável pelo primeiro atendimento do ticket. Enquanto o chamado estiver aberto, o usuário será atendido inicialmente pela IA. Se necessário, um atendente humano assumirá a conversa no mesmo chat.",
});

const toPlain = (value) => (value && typeof value.get === "function" ? value.get({ plain: true }) : value) || null;

const safeJsonParse = (value) => {
  try {
    return value == null ? null : JSON.parse(value);
  } catch {
    return null;
  }
};

const buildProtocol = (ticketId) => `3330${String(ticketId || "").padStart(4, "0")}`;

const getMessageSenderName = ({ senderType, senderName, senderUser }) => {
  if (senderName) return senderName;
  if (senderUser?.name) return senderUser.name;

  console.log({ senderName, senderType, senderUser }); // Log para depuração de mensagens sem nome de remetente

  if (senderType === TICKET_MESSAGE_SENDER.BOT) return BOT_AGENT.name;
  if (senderType === TICKET_MESSAGE_SENDER.SISTEMA) return "Resolve Mais";
  if (senderType === TICKET_MESSAGE_SENDER.CLIENTE) return "Cliente";
  if (senderType === TICKET_MESSAGE_SENDER.EMPRESA) return "Empresa";
  if (senderType === TICKET_MESSAGE_SENDER.FUNCIONARIO) return "Atendente";

  return "Mensagem";
};

const getTicketStage = (status) => {
  const normalizedStatus = normalizeTicketStatus(status);

  if (normalizedStatus === TICKET_STATUS.ABERTO) return "chatbot";
  if (normalizedStatus === TICKET_STATUS.PENDENTE) return "human";
  if (normalizedStatus === TICKET_STATUS.RESOLVIDO) return "resolved";
  if (normalizedStatus === TICKET_STATUS.FECHADO) return "closed";
  return "chatbot";
};

const formatUserSummary = (user) => {
  const plainUser = toPlain(user);
  if (!plainUser) return null;

  return {
    id: plainUser.id,
    name: plainUser.name,
    email: plainUser.email,
    phone: plainUser.phone || null,
    avatarUrl: plainUser.avatarUrl || null,
    jobTitle: plainUser.jobTitle || null,
    userType: plainUser.userType || null,
  };
};

const getTicketEvaluation = (ticket) => {
  const plainTicket = toPlain(ticket);
  if (!plainTicket) return null;

  const rating = Number(plainTicket.customerRating || plainTicket.customer_rating || 0);
  const submittedAt =
    plainTicket.customerEvaluatedAt || plainTicket.customer_evaluated_at || null;
  const resolutionSource = (() => {
    const explicitResolutionSource =
      plainTicket.resolutionSource || plainTicket.resolution_source || null;

    if (explicitResolutionSource) return explicitResolutionSource;

    return plainTicket.assignedUserId ||
      plainTicket.assigned_user_id ||
      plainTicket.acceptedAt ||
      plainTicket.accepted_at
      ? TICKET_RESOLUTION_SOURCE.HUMAN
      : TICKET_RESOLUTION_SOURCE.CHATBOT;
  })();
  const normalizedStatus = normalizeTicketStatus(plainTicket.status);

  return {
    rating: rating > 0 ? rating : null,
    comment:
      plainTicket.customerFeedback || plainTicket.customer_feedback || null,
    submittedAt,
    resolutionSource,
    pending:
      normalizedStatus === TICKET_STATUS.RESOLVIDO &&
      !submittedAt,
  };
};

const isTicketAssignedToUser = (ticket, userId) => {
  const plainTicket = toPlain(ticket);
  const assignedUserId =
    plainTicket?.assignedUserId ||
    plainTicket?.assignedEmployee?.id ||
    plainTicket?.assignedEmployeeId ||
    null;

  return Number(assignedUserId || 0) === Number(userId || 0);
};

const canContextViewTicket = (ticket, context) => {
  if (context?.scope !== "employee") return true;

  const plainTicket = toPlain(ticket);
  const normalizedStatus = normalizeTicketStatus(plainTicket?.status);

  if (normalizedStatus === TICKET_STATUS.ABERTO) {
    return true;
  }

  return isTicketAssignedToUser(plainTicket, context.user.id);
};

const filterTicketsByContext = (tickets, context) =>
  (Array.isArray(tickets) ? tickets : []).filter((ticket) =>
    canContextViewTicket(ticket, context)
  );

const buildTicketPermissions = (ticket, context) => {
  const normalizedStatus = normalizeTicketStatus(ticket.status);
  const isCustomer = context.scope === "customer";
  const isEmployee = context.scope === "employee";
  const isCompanyAdmin = context.scope === "company_admin";
  const isAssignedEmployee = isTicketAssignedToUser(ticket, context.user.id);
  const canEmployeeAct = isEmployee && (!ticket.assignedUserId || isAssignedEmployee);
  const hasCustomerEvaluation = Boolean(ticket.customerEvaluatedAt || ticket.customer_evaluated_at);

  return {
    canUseChatbot: isCustomer && normalizedStatus === TICKET_STATUS.ABERTO,
    canSendHumanMessage:
      !isClosedTicketStatus(normalizedStatus) &&
      ((isCustomer && normalizedStatus !== TICKET_STATUS.ABERTO) ||
        (canEmployeeAct && normalizedStatus !== TICKET_STATUS.ABERTO)),
    canAccept:
      isEmployee && normalizedStatus === TICKET_STATUS.ABERTO,
    canAssign:
      isCompanyAdmin && !isClosedTicketStatus(normalizedStatus),
    canResolve:
      canEmployeeAct && normalizedStatus === TICKET_STATUS.PENDENTE,
    canResolveByCustomer:
      isCustomer && normalizedStatus === TICKET_STATUS.ABERTO,
    canClose:
      isCustomer &&
      normalizedStatus === TICKET_STATUS.RESOLVIDO &&
      hasCustomerEvaluation,
    canReopen:
      isCustomer &&
      [
        TICKET_STATUS.RESOLVIDO,
        TICKET_STATUS.FECHADO,
      ].includes(normalizedStatus),
    canSubmitEvaluation:
      isCustomer &&
      normalizedStatus === TICKET_STATUS.RESOLVIDO &&
      !hasCustomerEvaluation,
  };
};

const formatTicket = (ticket, context = null) => {
  const plainTicket = toPlain(ticket);
  if (!plainTicket) return null;

  const normalizedStatus = normalizeTicketStatus(plainTicket.status);

  return {
    id: plainTicket.id,
    protocol: buildProtocol(plainTicket.id),
    description: plainTicket.description,
    status: normalizedStatus,
    stage: getTicketStage(normalizedStatus),
    createdAt: plainTicket.createdAt,
    updatedAt: plainTicket.updatedAt,
    acceptedAt: plainTicket.acceptedAt || null,
    resolvedAt: plainTicket.resolvedAt || null,
    closedAt: plainTicket.closedAt || null,
    reopenedAt: plainTicket.reopenedAt || null,
    lastInteractionAt: plainTicket.lastInteractionAt || null,
    autoClosedAt: plainTicket.autoClosedAt || null,
    lastUpdateMessage: plainTicket.lastUpdateMessage || null,
    company: plainTicket.empresa
      ? {
        id: plainTicket.empresa.id,
        name: plainTicket.empresa.name,
        description: plainTicket.empresa.description || null,
        cnpj: plainTicket.empresa.cnpj || null,
      }
      : null,
    complaintTitle: plainTicket.tituloReclamacao
      ? {
        id: plainTicket.tituloReclamacao.id,
        title: plainTicket.tituloReclamacao.title,
        description: plainTicket.tituloReclamacao.description || null,
      }
      : null,
    customer: formatUserSummary(plainTicket.cliente),
    assignedEmployee: formatUserSummary(plainTicket.assignedEmployee),
    evaluation: getTicketEvaluation(plainTicket),
    permissions: context ? buildTicketPermissions(plainTicket, context) : null,
  };
};

const formatMessage = (message) => {
  const plainMessage = toPlain(message);
  if (!plainMessage) return null;

  console.log({ plainMessage });

  return {
    id: plainMessage.id,
    role: plainMessage.role,
    content: plainMessage.content,
    senderType: plainMessage.senderType || plainMessage.sender_type || null,
    senderName: getMessageSenderName({
      senderType: plainMessage.senderType || plainMessage.sender_type,
      senderName: plainMessage.senderName || plainMessage.sender_name,
      senderUser: plainMessage.senderUser,
    }),
    senderUserId: plainMessage.senderUserId || plainMessage.sender_user_id || null,
    senderUser: formatUserSummary(plainMessage.senderUser),
    messageType: plainMessage.messageType || plainMessage.message_type || "chat",
    customerReadAt: plainMessage.customerReadAt || plainMessage.customer_read_at || null,
    companyReadAt: plainMessage.companyReadAt || plainMessage.company_read_at || null,
    createdAt: plainMessage.createdAt,
  };
};

const formatLog = (log) => {
  const plainLog = toPlain(log);
  if (!plainLog) return null;

  return {
    id: plainLog.id,
    message: plainLog.message,
    type: plainLog.type,
    statusFrom: plainLog.statusFrom || plainLog.status_from || null,
    statusTo: plainLog.statusTo || plainLog.status_to || null,
    createdAt: plainLog.createdAt,
    details: safeJsonParse(plainLog.details),
    actor: formatUserSummary(plainLog.actor),
    ticket: plainLog.ticket ? formatTicket(plainLog.ticket) : null,
  };
};

const formatWorkspaceSummary = (tickets) => ({
  total: tickets.length,
  aberto: tickets.filter((ticket) => ticket.status === TICKET_STATUS.ABERTO).length,
  pendente: tickets.filter((ticket) => ticket.status === TICKET_STATUS.PENDENTE).length,
  resolvido: tickets.filter((ticket) => ticket.status === TICKET_STATUS.RESOLVIDO).length,
  fechado: tickets.filter((ticket) => ticket.status === TICKET_STATUS.FECHADO).length,
  semResponsavel: tickets.filter((ticket) => !ticket.assignedEmployee).length,
});

const buildMessagePreview = (content, maxLength = 120) => {
  const normalizedContent = String(content || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedContent) return "";
  if (normalizedContent.length <= maxLength) return normalizedContent;

  return `${normalizedContent.slice(0, maxLength - 3).trim()}...`;
};

const getNotificationSourceLabel = (ticket, context) => {
  if (context.scope === "customer") {
    return ticket.company?.name || "Empresa";
  }

  return ticket.customer?.name || "Cliente";
};

const getSupportContext = async (authUser) => {
  if (!authUser?.id) {
    return { error: { status: 401, message: "Usuário não autenticado" } };
  }

  const normalizedUserType = normalizeUserType(authUser.userType);

  if (normalizedUserType === USER_TYPES.CLIENTE) {
    return {
      scope: "customer",
      viewerType: TICKET_VIEWER_TYPE.CUSTOMER,
      user: authUser,
      company: null,
      companyId: null,
    };
  }

  const adminCompany = await companyRepository.getByAdminUserId(authUser.id);

  if (adminCompany) {
    return {
      scope: "company_admin",
      viewerType: TICKET_VIEWER_TYPE.COMPANY,
      user: authUser,
      company: adminCompany,
      companyId: adminCompany.id,
    };
  }

  if (normalizedUserType === USER_TYPES.FUNCIONARIO && authUser.companyId) {
    const employeeCompany = await companyRepository.getById(authUser.companyId);

    return {
      scope: "employee",
      viewerType: TICKET_VIEWER_TYPE.COMPANY,
      user: authUser,
      company: employeeCompany || null,
      companyId: authUser.companyId,
    };
  }

  return {
    error: { status: 403, message: "Usuário sem permissão para acessar tickets" },
  };
};

const getTicketForContext = async ({ ticketId, context }) => {
  const parsedTicketId = Number(ticketId);

  if (!Number.isInteger(parsedTicketId) || parsedTicketId <= 0) {
    return { error: { status: 400, message: "Ticket invalido" } };
  }

  const ticket =
    context.scope === "customer"
      ? await ticketRepository.getByIdForUser({
        ticketId: parsedTicketId,
        userId: context.user.id,
      })
      : await ticketRepository.getByIdForCompany({
        ticketId: parsedTicketId,
        companyId: context.companyId,
      });

  if (!ticket) {
    return { error: { status: 404, message: "Ticket não encontrado" } };
  }

  if (!canContextViewTicket(ticket, context)) {
    return {
      error: {
        status: 403,
        message:
          "Somente o funcionário responsável pode visualizar este ticket enquanto ele estiver em atendimento.",
      },
    };
  }

  return { ticket };
};

const ensureTicketConversation = async (ticket) => {
  const plainTicket = toPlain(ticket);

  return chatbotRepository.getOrCreateConversationByTicket({
    ticketId: plainTicket.id,
    userId: plainTicket.cliente?.id,
  });
};

const createSystemMessageForTicket = async ({
  ticket,
  content,
  transaction = undefined,
}) => {
  const conversation = await ensureTicketConversation(ticket);

  return chatbotRepository.createMessage({
    conversationId: conversation.id,
    role: "system",
    content,
    senderType: TICKET_MESSAGE_SENDER.SISTEMA,
    senderName: "Resolve Mais",
    messageType: "system",
    transaction,
  });
};

const ensureInitialBotGreeting = async ({ ticket, context }) => {
  const formattedTicket = formatTicket(ticket, context);

  if (
    context.scope !== "customer" ||
    formattedTicket.status !== TICKET_STATUS.ABERTO
  ) {
    return chatbotRepository.listMessagesByTicketId(formattedTicket.id);
  }

  const { conversation, messages } = await chatbotRepository.listMessagesByTicketId(
    formattedTicket.id
  );

  if (conversation && messages.length > 0) {
    return { conversation, messages };
  }

  const ensuredConversation =
    conversation || (await ensureTicketConversation(ticket));

  const greeting = await chatbotRepository.createMessage({
    conversationId: ensuredConversation.id,
    role: "assistant",
    content: "Oi! Sou o Resolve Assist. Me conte o que aconteceu e vou tentar ajudar. Se eu não conseguir resolver por aqui, logo um atendente vai aceitar o chamado e dar continuidade ao seu atendimento.",
    senderType: TICKET_MESSAGE_SENDER.BOT,
    senderName: BOT_AGENT.name,
    messageType: "chat",
    customerReadAt: new Date(),
  });

  return {
    conversation: ensuredConversation,
    messages: [greeting],
  };
};

const getHumanSenderType = (context) => {
  if (context.scope === "customer") return TICKET_MESSAGE_SENDER.CLIENTE;
  if (context.scope === "company_admin") return TICKET_MESSAGE_SENDER.EMPRESA;
  return TICKET_MESSAGE_SENDER.FUNCIONARIO;
};

const buildReopenStatus = (ticket) =>
  ticket.assignedUserId || ticket.acceptedAt
    ? TICKET_STATUS.PENDENTE
    : TICKET_STATUS.ABERTO;

const getCompanyRecipientsForMessage = async (context, ticket) => {
  if (ticket.assignedEmployee?.email) {
    return [ticket.assignedEmployee];
  }

  const admins = await companyRepository.listAdmins(context.companyId);
  const primaryAdmins = admins.filter((adminLink) => adminLink.isPrimary);
  const selectedAdmins = primaryAdmins.length > 0 ? primaryAdmins : admins;

  return selectedAdmins
    .map((adminLink) => formatUserSummary(adminLink.user))
    .filter((admin) => admin?.email);
};

const createTicket = async ({
  description,
  userId,
  companyId,
  complaintTitleId,
}) => {
  try {
    if (!description?.trim()) {
      return { status: 400, message: "Descrição é obrigatória" };
    }
    if (!userId) return { status: 400, message: "Usuário não autenticado" };
    if (!companyId) return { status: 400, message: "Empresa é obrigatória" };
    if (!complaintTitleId) return { status: 400, message: "Assunto é obrigatório" };

    const newTicket = await ticketRepository.create({
      description: description.trim(),
      userId,
      companyId,
      complaintTitleId,
    });

    return {
      status: 201,
      message: "Ticket criado com sucesso",
      ticket: {
        id: newTicket.id,
        descricao: newTicket.description,
        status: normalizeTicketStatus(newTicket.status),
        criadoEm: newTicket.createdAt,
      },
    };
  } catch (error) {
    console.error("Erro ao criar ticket:", error);
    return {
      status: 500,
      message: "Erro interno ao criar ticket. Tente novamente mais tarde.",
    };
  }
};

const getCompanies = async () => {
  try {
    const companies = await companyRepository.getAll();
    return { status: 200, companies };
  } catch (error) {
    console.error("Erro ao buscar empresas:", error);
    return { status: 500, message: "Erro ao buscar empresas." };
  }
};

const getComplaintTitlesByCompany = async (companyId) => {
  try {
    if (!companyId) return { status: 400, message: "ID da empresa é obrigatório" };
    const complaintTitles = await ticketRepository.getComplaintTitlesByCompany(companyId);
    return { status: 200, complaintTitles };
  } catch (error) {
    console.error("Erro ao buscar assuntos:", error);
    return { status: 500, message: "Erro ao buscar assuntos." };
  }
};

const getUserTickets = async (userId) => {
  try {
    if (!userId) return { status: 400, message: "ID do usuário é obrigatório" };

    const tickets = await ticketRepository.getByUserId(userId);
    const sanitized = tickets.map((ticket) => {
      const formattedTicket = formatTicket(ticket);

      return {
        id: formattedTicket.id,
        empresa: formattedTicket.company?.name || "Empresa não informada",
        tituloReclamacao: formattedTicket.complaintTitle?.title || "Sem título",
        descricao: formattedTicket.description,
        status: formattedTicket.status,
        criadoEm: formattedTicket.createdAt,
      };
    });

    return { status: 200, tickets: sanitized };
  } catch (error) {
    console.error("Erro ao buscar tickets:", error);
    return { status: 500, message: "Erro ao buscar tickets." };
  }
};

const getUserOpenAndPendingTickets = async (userId) => {
  try {
    if (!userId) return { status: 400, message: "ID do usuário é obrigatório" };

    const tickets = await ticketRepository.getOpenAndPendingByUserId(userId);

    const sanitized = tickets.map((ticket) => {
      const formattedTicket = formatTicket(ticket);

      return {
        id: formattedTicket.id,
        empresa: formattedTicket.company?.name || "Empresa não informada",
        tituloReclamacao: formattedTicket.complaintTitle?.title || "Sem título",
        descricao: formattedTicket.description,
        status: formattedTicket.status,
        criadoEm: formattedTicket.createdAt,
        atribuidoPara: formattedTicket.assignedEmployee?.name || null,
        protocolo: formattedTicket.protocol,
      };
    });

    return { status: 200, tickets: sanitized };
  } catch (error) {
    console.error("Erro ao buscar tickets ativos:", error);
    return { status: 500, message: "Erro ao buscar tickets." };
  }
};

const getUserClosedTickets = async (userId) => {
  try {
    if (!userId) return { status: 400, message: "ID do usuário é obrigatório" };

    const tickets = await ticketRepository.getClosedByUserId(userId);

    const sanitized = tickets.map((ticket) => {
      const formattedTicket = formatTicket(ticket);

      return {
        id: formattedTicket.id,
        empresa: formattedTicket.company?.name || "Empresa não informada",
        tituloReclamacao: formattedTicket.complaintTitle?.title || "Sem título",
        descricao: formattedTicket.description,
        status: formattedTicket.status,
        criadoEm: formattedTicket.createdAt,
        finalizadoEm: formattedTicket.closedAt || formattedTicket.updatedAt,
      };
    });

    return { status: 200, tickets: sanitized };
  } catch (error) {
    console.error("Erro ao buscar tickets finalizados:", error);
    return { status: 500, message: "Erro ao buscar tickets finalizados." };
  }
};

const getRecentUpdates = async (userId) => {
  try {
    if (!userId) return { status: 400, message: "ID do usuário é obrigatório" };

    const updates = await ticketRepository.getRecentUpdates(userId, 3);

    return {
      status: 200,
      updates: updates.map((update) => {
        const formattedUpdate = formatLog(update);

        return {
          id: formattedUpdate.id,
          message: formattedUpdate.message,
          type: formattedUpdate.type,
          createdAt: formattedUpdate.createdAt,
          ticket: formattedUpdate.ticket
            ? {
              id: formattedUpdate.ticket.id,
              description: formattedUpdate.ticket.description,
              status: formattedUpdate.ticket.status,
              company: formattedUpdate.ticket.company?.name,
            }
            : null,
          actor: formattedUpdate.actor,
        };
      }),
    };
  } catch (error) {
    console.error("Erro ao buscar atualizações:", error);
    return { status: 500, message: "Erro ao buscar atualizações." };
  }
};

const getWorkspaceTickets = async (authUser, { scope = "active" } = {}) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    const statusFilter =
      scope === "closed"
        ? [TICKET_STATUS.FECHADO]
        : scope === "all"
          ? null
          : ACTIVE_TICKET_STATUSES;

    const rawTickets =
      context.scope === "customer"
        ? scope === "closed"
          ? await ticketRepository.getClosedByUserId(context.user.id)
          : scope === "all"
            ? await ticketRepository.getByUserId(context.user.id)
            : await ticketRepository.getOpenAndPendingByUserId(context.user.id)
        : await ticketRepository.listByCompanyId({
          companyId: context.companyId,
          statuses: statusFilter,
        });

    const tickets = filterTicketsByContext(rawTickets, context).map((ticket) =>
      formatTicket(ticket, context)
    );
    const allSummarySourceRaw =
      context.scope === "customer"
        ? await ticketRepository.getByUserId(context.user.id)
        : await ticketRepository.listByCompanyId({
          companyId: context.companyId,
        });
    const allSummarySource = filterTicketsByContext(
      allSummarySourceRaw,
      context
    ).map((ticket) => formatTicket(ticket, context));

    return {
      status: 200,
      scope: context.scope,
      company: context.company
        ? {
          id: context.company.id,
          name: context.company.name,
          description: context.company.description || null,
          cnpj: context.company.cnpj || null,
        }
        : null,
      tickets,
      summary: formatWorkspaceSummary(allSummarySource),
    };
  } catch (error) {
    console.error("Erro ao buscar workspace de tickets:", error);
    return { status: 500, message: "Erro ao carregar tickets." };
  }
};

const getUnreadMessageNotifications = async (authUser) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    const rawTickets =
      context.scope === "customer"
        ? await ticketRepository.getOpenAndPendingByUserId(context.user.id)
        : await ticketRepository.listByCompanyId({
          companyId: context.companyId,
          statuses: ACTIVE_TICKET_STATUSES,
        });

    const visibleTickets = filterTicketsByContext(rawTickets, context);
    const formattedTickets = visibleTickets
      .map((ticket) => formatTicket(ticket, context))
      .filter(Boolean);

    if (formattedTickets.length === 0) {
      return {
        status: 200,
        unreadCount: 0,
        unreadTickets: 0,
        notifications: [],
      };
    }

    const ticketMap = new Map(
      formattedTickets.map((ticket) => [String(ticket.id), ticket])
    );

    const unreadMessages = await chatbotRepository.listUnreadMessagesByTicketIds({
      ticketIds: formattedTickets.map((ticket) => ticket.id),
      viewerType: context.viewerType,
    });

    const groupedNotifications = unreadMessages.reduce((accumulator, message) => {
      const plainMessage = toPlain(message);
      const relatedTicketId =
        plainMessage?.conversation?.ticket_id ||
        plainMessage?.conversation?.ticketId ||
        null;

      if (!relatedTicketId) {
        return accumulator;
      }

      const relatedTicket = ticketMap.get(String(relatedTicketId));

      if (!relatedTicket) {
        return accumulator;
      }

      const currentEntry = accumulator.get(String(relatedTicketId));

      if (!currentEntry) {
        accumulator.set(String(relatedTicketId), {
          ticket: relatedTicket,
          latestMessage: plainMessage,
          unreadCount: 1,
        });
        return accumulator;
      }

      currentEntry.unreadCount += 1;

      const currentDate = new Date(currentEntry.latestMessage?.createdAt || 0).getTime();
      const nextDate = new Date(plainMessage?.createdAt || 0).getTime();

      if (nextDate > currentDate) {
        currentEntry.latestMessage = plainMessage;
      }

      return accumulator;
    }, new Map());

    const notifications = Array.from(groupedNotifications.values())
      .sort(
        (left, right) =>
          new Date(right.latestMessage?.createdAt || 0).getTime() -
          new Date(left.latestMessage?.createdAt || 0).getTime()
      )
      .map(({ ticket, latestMessage, unreadCount }) => ({
        ticketId: ticket.id,
        protocol: ticket.protocol,
        status: ticket.status,
        unreadCount,
        preview: buildMessagePreview(latestMessage?.content),
        sourceLabel: getNotificationSourceLabel(ticket, context),
        latestMessage: formatMessage(latestMessage),
        ticket: {
          id: ticket.id,
          protocol: ticket.protocol,
          status: ticket.status,
          companyName: ticket.company?.name || null,
          customerName: ticket.customer?.name || null,
          complaintTitle: ticket.complaintTitle?.title || null,
        },
      }));

    return {
      status: 200,
      unreadCount: unreadMessages.length,
      unreadTickets: notifications.length,
      notifications,
    };
  } catch (error) {
    console.error("Erro ao buscar notificações de mensagens:", error);
    return { status: 500, message: "Erro ao carregar notificações." };
  }
};

const getTicketDetail = async (authUser, ticketId) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    return {
      status: 200,
      ticket: formatTicket(ticketResponse.ticket, context),
      botAgent: BOT_AGENT,
    };
  } catch (error) {
    console.error("Erro ao buscar detalhe do ticket:", error);
    return { status: 500, message: "Erro ao carregar ticket." };
  }
};

const getTicketMessages = async (authUser, ticketId) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    const initializedConversation = await ensureInitialBotGreeting({
      ticket: ticketResponse.ticket,
      context,
    });

    const conversation = initializedConversation?.conversation || null;
    const messages = initializedConversation?.messages || [];

    if (conversation?.id) {
      await chatbotRepository.markConversationMessagesAsRead({
        conversationId: conversation.id,
        viewerType: context.viewerType,
      });
    }

    return {
      status: 200,
      ticket: formatTicket(ticketResponse.ticket, context),
      conversation: conversation
        ? {
          id: conversation.id,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        }
        : null,
      messages: messages.map(formatMessage),
      botAgent: BOT_AGENT,
    };
  } catch (error) {
    console.error("Erro ao buscar mensagens do ticket:", error);
    return { status: 500, message: "Erro ao carregar mensagens." };
  }
};

const markTicketMessagesAsRead = async (authUser, ticketId) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    await chatbotRepository.markTicketMessagesAsRead({
      ticketId,
      viewerType: context.viewerType,
    });

    return { status: 200, message: "Mensagens marcadas como visualizadas." };
  } catch (error) {
    console.error("Erro ao marcar mensagens como lidas:", error);
    return { status: 500, message: "Erro ao atualizar leitura." };
  }
};

const getTicketLogs = async (authUser, ticketId) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    const logs = await ticketRepository.getTicketLogsByTicketId(ticketId);

    return {
      status: 200,
      ticket: formatTicket(ticketResponse.ticket, context),
      logs: logs.map(formatLog),
    };
  } catch (error) {
    console.error("Erro ao buscar logs do ticket:", error);
    return { status: 500, message: "Erro ao carregar logs do ticket." };
  }
};

const getCompanyLogs = async (authUser) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    if (context.scope !== "company_admin") {
      return {
        status: 403,
        message: "Apenas o administrador da empresa pode visualizar os logs gerais da empresa.",
      };
    }

    const logs = await ticketRepository.getTicketLogsByCompanyId({
      companyId: context.companyId,
    });

    return {
      status: 200,
      company: context.company
        ? {
          id: context.company.id,
          name: context.company.name,
        }
        : null,
      logs: logs.map(formatLog),
    };
  } catch (error) {
    console.error("Erro ao buscar logs da empresa:", error);
    return { status: 500, message: "Erro ao carregar logs." };
  }
};

const sendTicketMessage = async (authUser, ticketId, content) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    const cleanContent = String(content || "").trim();
    if (!cleanContent) {
      return { status: 400, message: "Mensagem obrigatória." };
    }

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    const ticket = toPlain(ticketResponse.ticket);
    const normalizedStatus = normalizeTicketStatus(ticket.status);

    if (context.scope === "company_admin") {
      return {
        status: 403,
        message: "O administrador da empresa pode apenas acompanhar o historico e alterar o responsável do ticket.",
      };
    }

    if (isClosedTicketStatus(normalizedStatus)) {
      return { status: 400, message: "O ticket ja esta fechado." };
    }

    if (context.scope === "customer" && normalizedStatus === TICKET_STATUS.ABERTO) {
      return {
        status: 400,
        message: "Enquanto o ticket estiver aberto, a conversa inicial deve seguir pelo chatbot.",
      };
    }

    if (context.scope !== "customer" && normalizedStatus === TICKET_STATUS.ABERTO) {
      return {
        status: 400,
        message: "Aceite o ticket antes de responder ao cliente.",
      };
    }

    if (
      context.scope === "employee" &&
      ticket.assignedUserId &&
      Number(ticket.assignedUserId) !== Number(context.user.id)
    ) {
      return {
        status: 403,
        message: "Somente o funcionário responsável pode responder neste ticket.",
      };
    }

    const conversation = await ensureTicketConversation(ticketResponse.ticket);
    const senderType = getHumanSenderType(context);
    const now = new Date();
    const shouldMarkCustomerRead =
      context.viewerType === TICKET_VIEWER_TYPE.COMPANY &&
      hasViewerTypeConnected({
        ticketId,
        viewerType: TICKET_VIEWER_TYPE.CUSTOMER,
      });
    const shouldMarkCompanyRead =
      context.viewerType === TICKET_VIEWER_TYPE.CUSTOMER &&
      hasViewerTypeConnected({
        ticketId,
        viewerType: TICKET_VIEWER_TYPE.COMPANY,
      });

    const createdMessage = await chatbotRepository.createMessage({
      conversationId: conversation.id,
      role: context.scope === "customer" ? "user" : "assistant",
      content: cleanContent,
      senderType,
      senderName: context.user.name,
      senderUserId: context.user.id,
      messageType: "chat",
      customerReadAt: shouldMarkCustomerRead ? now : null,
      companyReadAt: shouldMarkCompanyRead ? now : null,
    });

    const formattedCreatedMessage = formatMessage({
      ...toPlain(createdMessage),
      senderUser: context.user,
    });

    const createdLog = await ticketRepository.createUpdate({
      ticketId,
      message: context.scope === "customer" ? `${context.user.name} enviou uma nova mensagem` : `${context.user.name} respondeu ao ticket`,
      type: TICKET_LOG_TYPE.MESSAGE,
      actorUserId: context.user.id,
      details: { senderType },
    });

    broadcastTicketEvent(ticketId, "message_created", {
      ticketId: Number(ticketId),
      message: formattedCreatedMessage,
    });
    broadcastTicketEvent(ticketId, "log_created", {
      ticketId: Number(ticketId),
      log: formatLog(createdLog),
    });

    return {
      status: 201,
      message: "Mensagem enviada com sucesso.",
      chatMessage: formattedCreatedMessage,
    };
  } catch (error) {
    console.error("Erro ao enviar mensagem do ticket:", error);
    return { status: 500, message: "Erro ao enviar mensagem." };
  }
};

const resolveAssignableEmployee = async ({
  companyId,
  assignedUserId = null,
  fallbackUser = null,
}) => {
  const targetUserId =
    assignedUserId !== null && assignedUserId !== undefined && assignedUserId !== ""
      ? Number(assignedUserId)
      : normalizeUserType(fallbackUser?.userType) === USER_TYPES.FUNCIONARIO
        ? Number(fallbackUser.id)
        : null;

  if (!targetUserId) return { employee: null };

  const employee = await userRepository.getById(targetUserId);

  if (!employee) return { error: { status: 404, message: "Funcionario não encontrado." } };

  if (
    normalizeUserType(employee.userType) !== USER_TYPES.FUNCIONARIO ||
    Number(employee.companyId) !== Number(companyId)
  ) {
    return {
      error: {
        status: 400,
        message: "O funcionário informado não pertence a esta empresa.",
      },
    };
  }

  return { employee };
};

const acceptTicket = async (authUser, ticketId, assignedUserId = null) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    if (context.scope === "customer") {
      return { status: 403, message: "Somente a empresa pode aceitar tickets." };
    }

    if (context.scope === "company_admin") {
      return {
        status: 403,
        message: "O administrador da empresa deve definir o responsável pelo ticket em vez de aceitar o atendimento diretamente.",
      };
    }

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    const ticket = toPlain(ticketResponse.ticket);

    if (normalizeTicketStatus(ticket.status) !== TICKET_STATUS.ABERTO) {
      return { status: 400, message: "Somente tickets abertos podem ser aceitos." };
    }

    const assigneeResponse = await resolveAssignableEmployee({
      companyId: context.companyId,
      assignedUserId,
      fallbackUser: context.scope === "employee" ? context.user : null,
    });
    if (assigneeResponse.error) return assigneeResponse.error;

    const assignee = assigneeResponse.employee;
    const now = new Date();

    await ticketRepository.updateTicketById(ticketId, {
      status: TICKET_STATUS.PENDENTE,
      acceptedAt: now,
      updatedAt: now,
      lastInteractionAt: now,
      ...(assignee ? { assignedUserId: assignee.id } : {}),
    });

    const acceptanceLog = await ticketRepository.createUpdate({
      ticketId,
      message: `${context.user.name} aceitou o ticket`,
      type: TICKET_LOG_TYPE.ACCEPTANCE,
      actorUserId: context.user.id,
      statusFrom: ticket.status,
      statusTo: TICKET_STATUS.PENDENTE,
      details: assignee
        ? {
          assignedEmployeeId: assignee.id,
          assignedEmployeeName: assignee.name,
        }
        : null,
    });

    let assignmentLog = null;
    if (assignee) {
      assignmentLog = await ticketRepository.createUpdate({
        ticketId,
        message: `Responsável definido para ${assignee.name}`,
        type: TICKET_LOG_TYPE.ASSIGNMENT,
        actorUserId: context.user.id,
        details: {
          assignedEmployeeId: assignee.id,
          assignedEmployeeName: assignee.name,
        },
      });
    }

    const systemMessage = await createSystemMessageForTicket({
      ticket: ticketResponse.ticket,
      content: assignee
        ? `${context.user.name} iniciou o atendimento humano e direcionou o ticket para ${assignee.name}.`
        : `${context.user.name} iniciou o atendimento humano.`,
    });

    const updatedTicketResponse = await getTicketForContext({ ticketId, context });
    const formattedTicket = formatTicket(updatedTicketResponse.ticket, context);

    broadcastTicketEvent(ticketId, "status_changed", {
      ticketId: Number(ticketId),
      status: formattedTicket.status,
      ticket: formattedTicket,
    });
    broadcastTicketEvent(ticketId, "message_created", {
      ticketId: Number(ticketId),
      message: formatMessage(systemMessage),
    });
    broadcastTicketEvent(ticketId, "log_created", {
      ticketId: Number(ticketId),
      log: formatLog(acceptanceLog),
    });

    if (assignmentLog) {
      broadcastTicketEvent(ticketId, "log_created", {
        ticketId: Number(ticketId),
        log: formatLog(assignmentLog),
      });
    }

    return {
      status: 200,
      message: "Ticket aceito com sucesso.",
      ticket: formattedTicket,
    };
  } catch (error) {
    console.error("Erro ao aceitar ticket:", error);
    return { status: 500, message: "Erro ao aceitar ticket." };
  }
};

const updateTicketAssignment = async (authUser, ticketId, assignedUserId) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    if (context.scope !== "company_admin") {
      return {
        status: 403,
        message: "Somente administradores da empresa podem reatribuir tickets.",
      };
    }

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    const ticket = toPlain(ticketResponse.ticket);

    if (isClosedTicketStatus(ticket.status)) {
      return { status: 400, message: "Não é possível reatribuir um ticket fechado." };
    }

    const assigneeResponse = await resolveAssignableEmployee({
      companyId: context.companyId,
      assignedUserId,
    });
    if (assigneeResponse.error) return assigneeResponse.error;

    const assignee = assigneeResponse.employee;
    const previousAssignee = formatUserSummary(ticket.assignedEmployee);
    const nextStatus =
      normalizeTicketStatus(ticket.status) === TICKET_STATUS.ABERTO && assignee
        ? TICKET_STATUS.PENDENTE
        : normalizeTicketStatus(ticket.status);

    const now = new Date();

    await ticketRepository.updateTicketById(ticketId, {
      assignedUserId: assignee?.id || null,
      status: nextStatus,
      ...(nextStatus === TICKET_STATUS.PENDENTE && !ticket.acceptedAt
        ? { acceptedAt: now }
        : {}),
      updatedAt: now,
      lastInteractionAt: now,
    });

    const assignmentLog = await ticketRepository.createUpdate({
      ticketId,
      message: assignee
        ? `Responsável alterado para ${assignee.name}`
        : "Responsável removido do ticket",
      type: TICKET_LOG_TYPE.ASSIGNMENT,
      actorUserId: context.user.id,
      details: {
        previousAssignedEmployee: previousAssignee,
        nextAssignedEmployee: assignee ? formatUserSummary(assignee) : null,
      },
    });

    let statusLog = null;
    if (nextStatus !== normalizeTicketStatus(ticket.status)) {
      statusLog = await ticketRepository.createUpdate({
        ticketId,
        message: `${context.user.name} colocou o ticket em atendimento humano`,
        type: TICKET_LOG_TYPE.STATUS_CHANGE,
        actorUserId: context.user.id,
        statusFrom: ticket.status,
        statusTo: nextStatus,
      });
    }

    const systemMessage = await createSystemMessageForTicket({
      ticket: ticketResponse.ticket,
      content: assignee
        ? `${context.user.name} definiu ${assignee.name} como responsável pelo ticket.`
        : `${context.user.name} removeu o responsável atual do ticket.`,
    });

    const updatedTicketResponse = await getTicketForContext({ ticketId, context });
    const formattedTicket = formatTicket(updatedTicketResponse.ticket, context);

    broadcastTicketEvent(ticketId, "ticket_updated", {
      ticketId: Number(ticketId),
      ticket: formattedTicket,
    });
    broadcastTicketEvent(ticketId, "message_created", {
      ticketId: Number(ticketId),
      message: formatMessage(systemMessage),
    });
    broadcastTicketEvent(ticketId, "log_created", {
      ticketId: Number(ticketId),
      log: formatLog(assignmentLog),
    });

    if (statusLog) {
      broadcastTicketEvent(ticketId, "status_changed", {
        ticketId: Number(ticketId),
        status: formattedTicket.status,
        ticket: formattedTicket,
      });
      broadcastTicketEvent(ticketId, "log_created", {
        ticketId: Number(ticketId),
        log: formatLog(statusLog),
      });
    }

    return {
      status: 200,
      message: "Responsável atualizado com sucesso.",
      ticket: formattedTicket,
    };
  } catch (error) {
    console.error("Erro ao reatribuir ticket:", error);
    return { status: 500, message: "Erro ao atualizar responsável do ticket." };
  }
};

const updateTicketStatus = async (authUser, ticketId, requestedStatus) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    const ticket = toPlain(ticketResponse.ticket);
    const currentStatus = normalizeTicketStatus(ticket.status);
    let nextStatus = normalizeTicketStatus(requestedStatus);

    if (requestedStatus === "reabrir" || requestedStatus === "reaberto") {
      nextStatus = buildReopenStatus(ticket);
    }

    if (!nextStatus) {
      return { status: 400, message: "Status solicitado invalido." };
    }

    if (currentStatus === nextStatus) {
      return { status: 400, message: "O ticket ja esta nesse status." };
    }

    const now = new Date();
    const updatePayload = {
      status: nextStatus,
      updatedAt: now,
      lastInteractionAt: now,
    };
    let logType = TICKET_LOG_TYPE.STATUS_CHANGE;
    let systemMessageText = "";

    if (context.scope === "customer") {
      if (currentStatus === TICKET_STATUS.ABERTO && nextStatus === TICKET_STATUS.RESOLVIDO) {
        updatePayload.resolvedAt = now;
        updatePayload.resolutionSource = TICKET_RESOLUTION_SOURCE.CHATBOT;
        updatePayload.customerRating = null;
        updatePayload.customerFeedback = null;
        updatePayload.customerEvaluatedAt = null;
        systemMessageText = "O cliente informou que o chatbot conseguiu resolver o problema.";
        logType = TICKET_LOG_TYPE.RESOLUTION;
      } else if (
        currentStatus === TICKET_STATUS.RESOLVIDO &&
        nextStatus === TICKET_STATUS.FECHADO
      ) {
        if (!ticket.customerEvaluatedAt && !ticket.customer_evaluated_at) {
          return {
            status: 400,
            message: "Envie a avaliação do atendimento antes de encerrar o ticket.",
          };
        }
        updatePayload.closedAt = now;
        systemMessageText = "O cliente encerrou o ticket.";
        logType = TICKET_LOG_TYPE.CLOSURE;
      } else if (
        [
          TICKET_STATUS.RESOLVIDO,
          TICKET_STATUS.FECHADO,
        ].includes(currentStatus) &&
        (nextStatus === TICKET_STATUS.ABERTO ||
          nextStatus === TICKET_STATUS.PENDENTE)
      ) {
        updatePayload.reopenedAt = now;
        updatePayload.closedAt = null;
        updatePayload.resolvedAt = null;
        updatePayload.autoClosedAt = null;
        updatePayload.resolutionSource = null;
        updatePayload.customerRating = null;
        updatePayload.customerFeedback = null;
        updatePayload.customerEvaluatedAt = null;
        systemMessageText = "O cliente reabriu o ticket.";
        logType = TICKET_LOG_TYPE.REOPENED;
      } else {
        return {
          status: 400,
          message: "O cliente não pode fazer essa alteração de status.",
        };
      }
    }

    if (context.scope === "employee") {
      const isAssignedEmployee =
        !ticket.assignedUserId || Number(ticket.assignedUserId) === Number(context.user.id);

      if (!isAssignedEmployee) {
        return {
          status: 403,
          message: "Somente o funcionário responsável pode resolver este ticket.",
        };
      }

      if (
        currentStatus === TICKET_STATUS.PENDENTE &&
        nextStatus === TICKET_STATUS.RESOLVIDO
      ) {
        updatePayload.resolvedAt = now;
        updatePayload.resolutionSource = TICKET_RESOLUTION_SOURCE.HUMAN;
        updatePayload.customerRating = null;
        updatePayload.customerFeedback = null;
        updatePayload.customerEvaluatedAt = null;
        systemMessageText = `${context.user.name} marcou o ticket como resolvido.`;
        logType = TICKET_LOG_TYPE.RESOLUTION;
      } else {
        return {
          status: 400,
          message: "O funcionário não pode fazer essa alteração de status.",
        };
      }
    }

    if (context.scope === "company_admin") {
      return {
        status: 400,
        message: "Use as ações de aceite e atribuição. O encerramento da resolução cabe ao funcionário ou ao cliente.",
      };
    }

    await ticketRepository.updateTicketById(ticketId, updatePayload);

    const statusLog = await ticketRepository.createUpdate({
      ticketId,
      message: systemMessageText || `${context.user.name} alterou o status do ticket.`,
      type: logType,
      actorUserId: context.user.id,
      statusFrom: currentStatus,
      statusTo: nextStatus,
    });

    const systemMessage = await createSystemMessageForTicket({
      ticket: ticketResponse.ticket,
      content: systemMessageText,
    });

    const updatedTicketResponse = await getTicketForContext({ ticketId, context });
    const formattedTicket = formatTicket(updatedTicketResponse.ticket, context);

    broadcastTicketEvent(ticketId, "status_changed", {
      ticketId: Number(ticketId),
      status: formattedTicket.status,
      ticket: formattedTicket,
    });
    broadcastTicketEvent(ticketId, "message_created", {
      ticketId: Number(ticketId),
      message: formatMessage(systemMessage),
    });
    broadcastTicketEvent(ticketId, "log_created", {
      ticketId: Number(ticketId),
      log: formatLog(statusLog),
    });

    return {
      status: 200,
      message: "Status atualizado com sucesso.",
      ticket: formattedTicket,
    };
  } catch (error) {
    console.error("Erro ao atualizar status do ticket:", error);
    return { status: 500, message: "Erro ao atualizar status do ticket." };
  }
};

const submitTicketEvaluation = async (
  authUser,
  ticketId,
  { rating, comment = "" } = {}
) => {
  try {
    const context = await getSupportContext(authUser);
    if (context.error) return context.error;

    if (context.scope !== "customer") {
      return {
        status: 403,
        message: "Somente o cliente pode avaliar o atendimento.",
      };
    }

    const ticketResponse = await getTicketForContext({ ticketId, context });
    if (ticketResponse.error) return ticketResponse.error;

    const ticket = toPlain(ticketResponse.ticket);
    const normalizedStatus = normalizeTicketStatus(ticket.status);
    const parsedRating = Number(rating);
    const normalizedComment = String(comment || "").trim();
    const resolutionSource = getTicketEvaluation(ticket)?.resolutionSource || null;

    if (
      !Number.isInteger(parsedRating) ||
      parsedRating < 1 ||
      parsedRating > 5
    ) {
      return {
        status: 400,
        message: "A nota da avaliação deve ser um número entre 1 e 5.",
      };
    }

    if (normalizedStatus !== TICKET_STATUS.RESOLVIDO) {
      return {
        status: 400,
        message: "A avaliação só pode ser enviada quando o ticket estiver resolvido.",
      };
    }

    if (ticket.customerEvaluatedAt || ticket.customer_evaluated_at) {
      return {
        status: 400,
        message: "A avaliação deste ticket já foi registrada.",
      };
    }

    const now = new Date();

    await ticketRepository.updateTicketById(ticketId, {
      customerRating: parsedRating,
      customerFeedback: normalizedComment || null,
      customerEvaluatedAt: now,
      updatedAt: now,
      lastInteractionAt: now,
    });

    const evaluationLog = await ticketRepository.createUpdate({
      ticketId,
      message: `Cliente avaliou o atendimento com ${parsedRating} estrela${parsedRating > 1 ? "s" : ""}.`,
      type: TICKET_LOG_TYPE.EVALUATION,
      actorUserId: context.user.id,
      details: {
        rating: parsedRating,
        comment: normalizedComment || null,
        resolutionSource,
      },
    });

    const updatedTicketResponse = await getTicketForContext({ ticketId, context });
    const formattedTicket = formatTicket(updatedTicketResponse.ticket, context);

    broadcastTicketEvent(ticketId, "ticket_updated", {
      ticketId: Number(ticketId),
      ticket: formattedTicket,
    });
    broadcastTicketEvent(ticketId, "log_created", {
      ticketId: Number(ticketId),
      log: formatLog(evaluationLog),
    });

    return {
      status: 200,
      message: "Avaliação registrada com sucesso.",
      ticket: formattedTicket,
    };
  } catch (error) {
    console.error("Erro ao registrar avaliação do ticket:", error);
    return { status: 500, message: "Erro ao registrar avaliação." };
  }
};

const getTicketStreamContext = async (authUser, ticketId) => {
  const context = await getSupportContext(authUser);
  if (context.error) return context;

  const ticketResponse = await getTicketForContext({ ticketId, context });
  if (ticketResponse.error) return ticketResponse;

  return {
    status: 200,
    context,
    ticket: formatTicket(ticketResponse.ticket, context),
  };
};

const autoCloseInactiveTickets = async () => {
  try {
    const cutoffDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const inactiveTickets = await ticketRepository.listInactiveOpenTickets({
      cutoffDate,
    });

    for (const inactiveTicket of inactiveTickets) {
      const plainTicket = toPlain(inactiveTicket);
      const now = new Date();

      await sequelize.transaction(async (transaction) => {
        await ticketRepository.updateTicketById(
          plainTicket.id,
          {
            status: TICKET_STATUS.FECHADO,
            closedAt: now,
            autoClosedAt: now,
            updatedAt: now,
          },
          { transaction }
        );

        await ticketRepository.createUpdate({
          ticketId: plainTicket.id,
          message: "Ticket fechado automaticamente por 2 dias sem interação.",
          type: TICKET_LOG_TYPE.AUTOMATION,
          statusFrom: plainTicket.status,
          statusTo: TICKET_STATUS.FECHADO,
          touchInteraction: false,
          transaction,
        });

        await createSystemMessageForTicket({
          ticket: inactiveTicket,
          content:
            "Este ticket foi fechado automaticamente por falta de interação durante 2 dias.",
          transaction,
        });
      });

      broadcastTicketEvent(plainTicket.id, "status_changed", {
        ticketId: plainTicket.id,
        status: TICKET_STATUS.FECHADO,
      });
    }
  } catch (error) {
    console.error("Erro ao fechar tickets inativos automaticamente:", error);
  }
};

const sendDelayedReplyReminders = async () => {
  try {
    const cutoffDate = new Date(Date.now() - 5 * 60 * 1000);
    const messages = await chatbotRepository.listMessagesPendingReminder({
      cutoffDate,
    });

    console.log(`Encontradas ${messages.length} mensagens pendentes de resposta para envio de lembretes.`);

    for (const message of messages) {
      const plainMessage = toPlain(message);
      const ticket = plainMessage?.conversation?.ticket;

      if (!ticket) continue;

      const senderType = plainMessage.senderType || plainMessage.sender_type;
      const senderName = getMessageSenderName({
        senderType,
        senderName: plainMessage.senderName || plainMessage.sender_name,
        senderUser: plainMessage.senderUser,
      });

      let recipients = [];
      let waitingFor = "uma resposta";

      if (senderType === TICKET_MESSAGE_SENDER.CLIENTE) {
        waitingFor = "retorno da empresa";
        recipients = await getCompanyRecipientsForMessage({ companyId: ticket.company_id || ticket.empresa?.id }, formatTicket(ticket));
      } else {
        waitingFor = "retorno do cliente";
        recipients = [formatUserSummary(ticket.cliente)].filter((recipient) => recipient?.email);
      }

      if (recipients.length === 0) continue;

      for (const recipient of recipients) {
        await sendTicketPendingReplyEmail({
          to: recipient.email,
          recipientName: recipient.name,
          senderName,
          companyName: ticket.empresa?.name,
          ticketId: ticket.id,
          subjectTitle: ticket.tituloReclamacao?.title,
          waitingFor,
        });
      }

      await chatbotRepository.markReminderSent({
        messageId: plainMessage.id,
      });
    }
  } catch (error) {
    console.error("Erro ao enviar lembretes de resposta:", error);
  }
};

const runTicketAutomationCycle = async () => {
  await autoCloseInactiveTickets();
  await sendDelayedReplyReminders();
};

const ticketService = {
  acceptTicket,
  createTicket,
  getCompanies,
  getCompanyLogs,
  getComplaintTitlesByCompany,
  getRecentUpdates,
  getTicketDetail,
  getTicketLogs,
  getTicketMessages,
  getUnreadMessageNotifications,
  getTicketStreamContext,
  getUserClosedTickets,
  getUserOpenAndPendingTickets,
  getUserTickets,
  getWorkspaceTickets,
  markTicketMessagesAsRead,
  runTicketAutomationCycle,
  sendTicketMessage,
  submitTicketEvaluation,
  updateTicketAssignment,
  updateTicketStatus,
};

export default ticketService;
