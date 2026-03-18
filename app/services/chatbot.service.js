const OpenAI = require("openai");
const chatbotRepository = require("../repositories/chatbot.repository");
const { CHATBOT_AGENT } = require("../config/chatbot.config");

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_HISTORY_MESSAGES = 20;

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
    createdAt: message.createdAt,
  }));

const mapHistoryToOpenAIMessages = (historyMessages) =>
  historyMessages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

const ensureConversation = async ({ userId, conversationId }) => {
  if (conversationId) {
    const existingConversation =
      await chatbotRepository.getConversationByIdForUser({
        conversationId,
        userId,
      });

    if (existingConversation) return existingConversation;
  }

  const activeConversation =
    await chatbotRepository.getActiveConversationByUserId(userId);

  if (activeConversation) return activeConversation;

  return chatbotRepository.createConversation({ userId });
};

const findConversationWithoutCreate = async ({ userId, conversationId }) => {
  if (conversationId) {
    return chatbotRepository.getConversationByIdForUser({
      conversationId,
      userId,
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
    const message =
      error?.message ||
      (typeof error === "string" ? error : "Erro ao consultar OpenAI.");

    throw createServiceError(
      `Erro ao consultar OpenAI: ${message}`.trim(),
      status
    );
  }
};

exports.getConversation = async ({ userId }) => {
  try {
    if (!userId) {
      return { status: 401, message: "Usuario nao autenticado." };
    }

    const conversation =
      await chatbotRepository.getActiveConversationByUserId(userId);

    if (!conversation) {
      return {
        status: 200,
        conversation: null,
        messages: [],
      agent: {
          name: AGENT.name,
          description: AGENT.description,
          prompt: AGENT.prompt,
      },
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
    };
  } catch (error) {
    console.error("Erro em getConversation:", error.message);
    return { status: 500, message: "Erro interno ao carregar conversa." };
  }
};

exports.clearConversation = async ({ userId, conversationId = null }) => {
  try {
    if (!userId) {
      return { status: 401, message: "Usuario nao autenticado." };
    }

    const conversation = await findConversationWithoutCreate({
      userId,
      conversationId,
    });

    if (!conversation) {
      return { status: 200, message: "Nenhuma conversa ativa para limpar." };
    }

    const deleted = await chatbotRepository.softDeleteConversation({
      conversationId: conversation.id,
      userId,
    });

    if (!deleted) {
      return { status: 404, message: "Conversa nao encontrada." };
    }

    return { status: 200, message: "Conversa limpa com sucesso." };
  } catch (error) {
    console.error("Erro em clearConversation:", error.message);
    return { status: 500, message: "Erro interno ao limpar conversa." };
  }
};

exports.streamMessage = async ({
  userId,
  message,
  conversationId,
  abortSignal,
  onStart,
  onToken,
}) => {
  if (!userId) {
    throw createServiceError("Usuario nao autenticado.", 401);
  }

  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) {
    throw createServiceError("Mensagem obrigatoria.", 400);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createServiceError(
      "Variavel OPENAI_API_KEY nao configurada no backend.",
      500
    );
  }

  const conversation = await ensureConversation({ userId, conversationId });
  const currentAgent = {
    name: AGENT.name,
    description: AGENT.description,
    prompt: AGENT.prompt,
  };

  onStart({
    conversationId: conversation.id,
    agent: currentAgent,
  });

  const recentHistoryDescending =
    await chatbotRepository.getMessagesByConversationId({
      conversationId: conversation.id,
      limit: MAX_HISTORY_MESSAGES,
      order: "DESC",
    });

  const historyAscending = [...recentHistoryDescending].reverse();

  await chatbotRepository.createMessage({
    conversationId: conversation.id,
    role: "user",
    content: cleanMessage,
  });

  const openAIMessages = [
    {
      role: "system",
      content: AGENT.prompt,
    },
    ...mapHistoryToOpenAIMessages(historyAscending),
    {
      role: "user",
      content: cleanMessage,
    },
  ];

  const assistantResponse = await streamOpenAICompletion({
    model: OPENAI_MODEL,
    apiKey,
    messages: openAIMessages,
    abortSignal,
    onToken,
  });

  if (!assistantResponse) {
    throw createServiceError("A IA nao retornou resposta valida.", 502);
  }

  const assistantMessage = await chatbotRepository.createMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: assistantResponse,
  });

  return {
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    agent: currentAgent,
  };
};
