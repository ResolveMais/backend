import chatbotService from "../services/chatbot.service.js";

const sendSseEvent = (res, eventName, payload) => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const getConversation = async (req, res) => {
  const response = await chatbotService.getConversation({
    userId: req.user?.id,
    ticketId: req.query?.ticketId || null,
  });

  return res.status(response.status).json(response);
};

const clearConversation = async (req, res) => {
  const response = await chatbotService.clearConversation({
    userId: req.user?.id,
    conversationId: req.body?.conversationId || null,
    ticketId: req.body?.ticketId || null,
  });

  return res.status(response.status).json(response);
};

const streamMessage = async (req, res) => {
  const { message, conversationId = null, ticketId = null } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ status: 400, message: "Mensagem obrigatoria." });
  }

  if (!req.user?.id) {
    return res.status(401).json({ status: 401, message: "Usuario nao autenticado." });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
  });

  try {
    const streamResult = await chatbotService.streamMessage({
      userId: req.user.id,
      message,
      conversationId,
      ticketId,
      abortSignal: abortController.signal,
      onStart: (payload) => sendSseEvent(res, "start", payload),
      onToken: (token) => sendSseEvent(res, "token", { token }),
    });

    sendSseEvent(res, "done", streamResult);
    return res.end();
  } catch (error) {
    console.error(error);

    if (abortController.signal.aborted) {
      return res.end();
    }

    const statusCode = error?.statusCode || 500;
    const messageToClient = statusCode === 500 ? "Erro interno ao processar mensagem." : error.message || "Erro ao processar mensagem.";

    sendSseEvent(res, "error", {
      status: statusCode,
      message: messageToClient,
    });

    return res.end();
  }
};

export { clearConversation, getConversation, streamMessage };

export default {
  getConversation,
  clearConversation,
  streamMessage,
};
