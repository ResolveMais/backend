import OpenAI from "openai";
import { CHATBOT_AGENT } from "../config/chatbot.config.js";
import chatbotRepository from "../repositories/chatbot.repository.js";
import ticketRepository from "../repositories/ticket.repository.js";
import { broadcastTicketEvent, hasViewerTypeConnected } from "../utils/ticketRealtime.js";
import {
  TICKET_LOG_TYPE,
  TICKET_MESSAGE_SENDER,
  TICKET_STATUS,
  TICKET_VIEWER_TYPE,
  normalizeTicketStatus,
} from "../utils/ticketStatus.js";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-nano";
const MAX_HISTORY_MESSAGES = 20;
const CHATBOT_UNAVAILABLE_FALLBACK_MESSAGE =
  "No momento, o Resolve Assist está indisponível. Seu ticket já foi registrado e logo um atendente assumirá o atendimento neste mesmo chat.";

const AGENT = Object.freeze(CHATBOT_AGENT);

const createServiceError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sanitizeStoredMessages = (messages) =>
  messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    senderType: message.senderType || message.sender_type || null,
    senderName: message.senderName || message.sender_name || null,
    senderUserId: message.senderUserId || message.sender_user_id || null,
    messageType: message.messageType || message.message_type || "chat",
    customerReadAt: message.customerReadAt || message.customer_read_at || null,
    companyReadAt: message.companyReadAt || message.company_read_at || null,
    createdAt: message.createdAt,
  }));

const mapHistoryToOpenAIMessages = (historyMessages) =>
  historyMessages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

const parseTicketId = (ticketId) => {
  if (ticketId === null || ticketId === undefined || ticketId === "") {
    return null;
  }

  const parsed = Number(ticketId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createServiceError("Ticket inválido.", 400);
  }

  return parsed;
};

const formatDateTime = (dateValue) => {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const buildRealtimeMessagePayload = (message) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  senderType: message.senderType || message.sender_type || null,
  senderName: message.senderName || message.sender_name || null,
  senderUserId: message.senderUserId || message.sender_user_id || null,
  messageType: message.messageType || message.message_type || "chat",
  customerReadAt: message.customerReadAt || message.customer_read_at || null,
  companyReadAt: message.companyReadAt || message.company_read_at || null,
  createdAt: message.createdAt,
});

const buildTicketContextPrompt = (ticket) => {
  if (!ticket) return null;

  const createdAt = formatDateTime(ticket.createdAt);
  const updatedAt = formatDateTime(ticket.updatedAt || ticket.createdAt);
  const empresa = ticket.empresa?.name || "Não informado";
  const assunto = ticket.tituloReclamacao?.title || "Não informado";

  const lines = [
    "Contexto do ticket do usuario (dados internos do sistema):",
    `Ticket ID: ${ticket.id}`,
    `Status: ${ticket.status}`,
    `Empresa: ${empresa}`,
    `Assunto: ${assunto}`,
    `Descrição: ${ticket.description}`,
  ];

  if (createdAt) lines.push(`Criado em: ${createdAt}`);
  if (updatedAt) lines.push(`Última atualização: ${updatedAt}`);
  if (ticket.lastUpdateMessage) {
    lines.push(`Última mensagem: ${ticket.lastUpdateMessage}`);
  }

  lines.push(
    "Use esse contexto para responder sobre status e andamento.",
    "Se algo não estiver aqui, diga que não há informação registrada."
  );

  return lines.join("\n");
};

const ensureConversation = async ({ userId, conversationId, ticketId = null }) => {
  if (conversationId) {
    const existingConversation = await chatbotRepository.getConversationByIdForUser({
      conversationId,
      userId,
      ticketId,
    });

    if (existingConversation) return existingConversation;
  }

  if (ticketId) {
    const ticketConversation =
      await chatbotRepository.getActiveConversationByUserAndTicketId({
        userId,
        ticketId,
      });

    if (ticketConversation) return ticketConversation;

    return chatbotRepository.createConversation({ userId, ticketId });
  }

  const activeConversation = await chatbotRepository.getActiveConversationByUserId(userId);

  if (activeConversation) return activeConversation;

  return chatbotRepository.createConversation({ userId });
};

const findConversationWithoutCreate = async ({
  userId,
  conversationId,
  ticketId = null,
}) => {
  if (conversationId) {
    const foundById = await chatbotRepository.getConversationByIdForUser({
      conversationId,
      userId,
      ticketId,
    });

    if (foundById) return foundById;
  }

  if (ticketId) {
    return chatbotRepository.getActiveConversationByUserAndTicketId({
      userId,
      ticketId,
    });
  }

  return chatbotRepository.getActiveConversationByUserId(userId);
};

const streamOpenAICompletion = async ({
  model,
  apiKey,
  messages,
  abortSignal,
  onToken,
}) => {
  try {
    if (abortSignal?.aborted) {
      throw createServiceError("Stream abortado.", 499);
    }

    const openai = new OpenAI({ apiKey });

    const stream = await openai.chat.completions.create(
      {
        model,
        messages,
        temperature: 0.3,
        stream: true,
      },
      { signal: abortSignal }
    );

    let fullAssistantResponse = "";

    for await (const chunk of stream) {
      if (abortSignal?.aborted) {
        throw createServiceError("Stream abortado.", 499);
      }

      const nextToken = chunk?.choices?.[0]?.delta?.content;

      if (typeof nextToken === "string" && nextToken.length > 0) {
        fullAssistantResponse += nextToken;
        onToken(nextToken);
      }
    }

    return fullAssistantResponse.trim();
  } catch (error) {
    const status = error?.status || error?.statusCode || 502;
    const message = error?.message || (typeof error === "string" ? error : "Erro ao consultar OpenAI.");
    const wrappedError = createServiceError(`Erro ao consultar OpenAI: ${message}`.trim(), status);

    if (fullAssistantResponse.trim()) {
      wrappedError.partialResponse = fullAssistantResponse;
      wrappedError.hasOutputToken = true;
    }

    throw wrappedError;
  }
};

const getConversation = async ({ userId, ticketId = null }) => {
  try {
    if (!userId) {
      return { status: 401, message: "Usuário não autenticado." };
    }

    const parsedTicketId = parseTicketId(ticketId);
    let ticket = null;

    if (parsedTicketId) {
      ticket = await ticketRepository.getByIdForUser({
        ticketId: parsedTicketId,
        userId,
      });

      if (!ticket) {
        return { status: 404, message: "Ticket não encontrado." };
      }
    }

    const conversation = parsedTicketId
      ? await chatbotRepository.getActiveConversationByUserAndTicketId({
        userId,
        ticketId: parsedTicketId,
      })
      : await chatbotRepository.getActiveConversationByUserId(userId);

    if (!conversation) {
      if (ticket && normalizeTicketStatus(ticket.status) === TICKET_STATUS.ABERTO) {
        const createdConversation = await chatbotRepository.createConversation({
          userId,
          ticketId: parsedTicketId,
        });

        const greetingMessage = await chatbotRepository.createMessage({
          conversationId: createdConversation.id,
          role: "assistant",
          content: "Oi! Sou o Resolve Assist. Me conte o que aconteceu e vou tentar te ajudar da melhor forma possível. Se eu não conseguir resolver por aqui, um atendente dará continuidade ao seu atendimento neste mesmo chamado.",
          senderType: TICKET_MESSAGE_SENDER.BOT,
          senderName: AGENT.name,
          messageType: "chat",
          customerReadAt: new Date(),
        });

        return {
          status: 200,
          conversation: {
            id: createdConversation.id,
            createdAt: createdConversation.createdAt,
            updatedAt: createdConversation.updatedAt,
          },
          messages: sanitizeStoredMessages([greetingMessage]),
          agent: {
            name: AGENT.name,
            description: AGENT.description,
            prompt: AGENT.prompt,
          },
          ticket: ticket
            ? {
              id: ticket.id,
              status: ticket.status,
              description: ticket.description,
              company: ticket.empresa?.name || null,
              subject: ticket.tituloReclamacao?.title || null,
              createdAt: ticket.createdAt,
              updatedAt: ticket.updatedAt,
              lastUpdateMessage: ticket.lastUpdateMessage || null,
            }
            : null,
        };
      }

      return {
        status: 200,
        conversation: null,
        messages: [],
        agent: {
          name: AGENT.name,
          description: AGENT.description,
          prompt: AGENT.prompt,
        },
        ticket: ticket
          ? {
            id: ticket.id,
            status: ticket.status,
            description: ticket.description,
            company: ticket.empresa?.name || null,
            subject: ticket.tituloReclamacao?.title || null,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            lastUpdateMessage: ticket.lastUpdateMessage || null,
          }
          : null,
      };
    }

    const messages = await chatbotRepository.getMessagesByConversationId({
      conversationId: conversation.id,
      order: "ASC",
    });

    return {
      status: 200,
      conversation: {
        id: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: sanitizeStoredMessages(messages),
      agent: {
        name: AGENT.name,
        description: AGENT.description,
        prompt: AGENT.prompt,
      },
      ticket: ticket
        ? {
          id: ticket.id,
          status: ticket.status,
          description: ticket.description,
          company: ticket.empresa?.name || null,
          subject: ticket.tituloReclamacao?.title || null,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          lastUpdateMessage: ticket.lastUpdateMessage || null,
        }
        : null,
    };
  } catch (error) {
    console.error("Erro em getConversation:", error.message);
    const status = error?.statusCode || 500;
    return {
      status,
      message: status === 500 ? "Erro interno ao carregar conversa." : error.message || "Erro ao carregar conversa.",
    };
  }
};

const clearConversation = async ({
  userId,
  conversationId = null,
  ticketId = null,
}) => {
  try {
    if (!userId) {
      return { status: 401, message: "Usuário não autenticado." };
    }

    const parsedTicketId = parseTicketId(ticketId);

    const conversation = await findConversationWithoutCreate({
      userId,
      conversationId,
      ticketId: parsedTicketId,
    });

    if (!conversation) {
      return { status: 200, message: "Nenhuma conversa ativa para limpar." };
    }

    const deleted = await chatbotRepository.softDeleteConversation({
      conversationId: conversation.id,
      userId,
    });

    if (!deleted) {
      return { status: 404, message: "Conversa não encontrada." };
    }

    return { status: 200, message: "Conversa limpa com sucesso." };
  } catch (error) {
    console.error("Erro em clearConversation:", error.message);
    const status = error?.statusCode || 500;
    return {
      status,
      message: status === 500 ? "Erro interno ao limpar conversa." : error.message || "Erro ao limpar conversa.",
    };
  }
};

const streamMessage = async ({
  userId,
  message,
  conversationId,
  ticketId = null,
  abortSignal,
  onStart,
  onToken,
}) => {
  if (!userId) throw createServiceError("Usuário não autenticado.", 401);

  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) {
    throw createServiceError("Mensagem obrigatoria.", 400);
  }

  const parsedTicketId = parseTicketId(ticketId);
  let ticket = null;

  if (parsedTicketId) {
    ticket = await ticketRepository.getByIdForUser({
      ticketId: parsedTicketId,
      userId,
    });

    if (!ticket) {
      throw createServiceError("Ticket não encontrado.", 404);
    }
  }

  const conversation = await ensureConversation({
    userId,
    conversationId,
    ticketId: parsedTicketId,
  });
  const currentAgent = {
    name: AGENT.name,
    description: AGENT.description,
    prompt: AGENT.prompt,
  };

  onStart({
    conversationId: conversation.id,
    agent: currentAgent,
    ticketId: parsedTicketId,
  });

  const recentHistoryDescending = await chatbotRepository.getMessagesByConversationId({
    conversationId: conversation.id,
    limit: MAX_HISTORY_MESSAGES,
    order: "DESC",
  });

  const historyAscending = [...recentHistoryDescending].reverse();

  const companyViewerConnected = parsedTicketId
    ? hasViewerTypeConnected({
      ticketId: parsedTicketId,
      viewerType: TICKET_VIEWER_TYPE.COMPANY,
    })
    : false;

  const createdUserMessage = await chatbotRepository.createMessage({
    conversationId: conversation.id,
    role: "user",
    content: cleanMessage,
    senderType: TICKET_MESSAGE_SENDER.CLIENTE,
    senderName: ticket?.cliente?.name || null,
    senderUserId: userId,
    companyReadAt: companyViewerConnected ? new Date() : null,
  });

  if (parsedTicketId) {
    await ticketRepository.createUpdate({
      ticketId: parsedTicketId,
      message: `${ticket?.cliente?.name || "Cliente"} enviou uma mensagem ao chatbot`,
      type: TICKET_LOG_TYPE.MESSAGE,
      actorUserId: userId,
      details: {
        senderType: TICKET_MESSAGE_SENDER.CLIENTE,
      },
    });

    broadcastTicketEvent(parsedTicketId, "message_created", {
      ticketId: parsedTicketId,
      message: buildRealtimeMessagePayload(createdUserMessage),
    });
  }

  const openAIMessages = [
    {
      role: "system",
      content: AGENT.prompt,
    },
    ...(ticket
      ? [
        {
          role: "system",
          content: buildTicketContextPrompt(ticket),
        },
      ]
      : []),
    ...mapHistoryToOpenAIMessages(historyAscending),
    {
      role: "user",
      content: cleanMessage,
    },
  ];

  let assistantResponse = "";
  let usedUnavailableFallback = false;

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw createServiceError(
        "Variavel OPENAI_API_KEY não configurada no backend.",
        503
      );
    }

    assistantResponse = await streamOpenAICompletion({
      model: OPENAI_MODEL,
      apiKey,
      messages: openAIMessages,
      abortSignal,
      onToken,
    });

    if (!assistantResponse) {
      throw createServiceError("A IA não retornou resposta válida.", 502);
    }
  } catch (error) {
    if (abortSignal?.aborted || error?.statusCode === 499) {
      throw error;
    }

    if (error?.hasOutputToken) {
      throw error;
    }

    assistantResponse = CHATBOT_UNAVAILABLE_FALLBACK_MESSAGE;
    usedUnavailableFallback = true;
    onToken(assistantResponse);
  }

  const assistantMessage = await chatbotRepository.createMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: assistantResponse,
    senderType: TICKET_MESSAGE_SENDER.BOT,
    senderName: AGENT.name,
    customerReadAt: new Date(),
    companyReadAt: companyViewerConnected ? new Date() : null,
  });

  if (parsedTicketId) {
    await ticketRepository.createUpdate({
      ticketId: parsedTicketId,
      message: usedUnavailableFallback
        ? "O chatbot ficou indisponível e informou que o atendimento seguirá com a equipe humana."
        : "O chatbot respondeu ao cliente",
      type: TICKET_LOG_TYPE.MESSAGE,
      details: {
        senderType: TICKET_MESSAGE_SENDER.BOT,
        fallbackUsed: usedUnavailableFallback,
      },
    });

    broadcastTicketEvent(parsedTicketId, "message_created", {
      ticketId: parsedTicketId,
      message: buildRealtimeMessagePayload(assistantMessage),
    });
  }

  return {
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    agent: currentAgent,
  };
};

export { clearConversation, getConversation, streamMessage };

export default {
  getConversation,
  clearConversation,
  streamMessage,
};
