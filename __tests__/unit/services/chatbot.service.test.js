import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const asModel = (data) => ({
  ...data,
  get: jest.fn(({ plain } = {}) => (plain ? { ...data } : data)),
});

const loadChatbotService = async ({
  chatbotRepositoryOverrides = {},
  ticketRepositoryOverrides = {},
  realtimeOverrides = {},
} = {}) => {
  jest.resetModules();

  const chatbotRepositoryMock = {
    getConversationByIdForUser: jest.fn(),
    getActiveConversationByUserAndTicketId: jest.fn(),
    createConversation: jest.fn(),
    getActiveConversationByUserId: jest.fn(),
    getMessagesByConversationId: jest.fn(),
    createMessage: jest.fn(),
    softDeleteConversation: jest.fn(),
    ...chatbotRepositoryOverrides,
  };
  const ticketRepositoryMock = {
    getByIdForUser: jest.fn(),
    createUpdate: jest.fn(),
    ...ticketRepositoryOverrides,
  };
  const realtimeMock = {
    broadcastTicketEvent: jest.fn(),
    hasViewerTypeConnected: jest.fn(() => false),
    ...realtimeOverrides,
  };

  jest.unstable_mockModule("openai", () => ({
    default: class OpenAI {
      constructor() {
        this.chat = {
          completions: {
            create: jest.fn(),
          },
        };
      }
    },
  }));
  jest.unstable_mockModule("../../../app/repositories/chatbot.repository.js", () => ({
    default: chatbotRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/repositories/ticket.repository.js", () => ({
    default: ticketRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/utils/ticketRealtime.js", () => ({
    broadcastTicketEvent: realtimeMock.broadcastTicketEvent,
    hasViewerTypeConnected: realtimeMock.hasViewerTypeConnected,
  }));

  const chatbotService = await import("../../../app/services/chatbot.service.js");

  return {
    chatbotService,
    chatbotRepositoryMock,
    ticketRepositoryMock,
    realtimeMock,
  };
};

describe("app/services/chatbot.service", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("getConversation rejects anonymous requests", async () => {
    const { chatbotService } = await loadChatbotService();

    await expect(chatbotService.getConversation({ userId: null })).resolves.toEqual({
      status: 401,
      message: "Usuário não autenticado.",
    });
  });

  test("getConversation creates the greeting for an open ticket without an active chat", async () => {
    const ticket = {
      id: 44,
      status: "aberto",
      description: "Cliente relatou cobrança duplicada",
      createdAt: "2026-04-30T10:00:00.000Z",
      updatedAt: "2026-04-30T10:05:00.000Z",
      empresa: { name: "Resolve Mais" },
      tituloReclamacao: { title: "Cobrança" },
    };
    const { chatbotService, chatbotRepositoryMock } = await loadChatbotService({
      ticketRepositoryOverrides: {
        getByIdForUser: jest.fn().mockResolvedValue(ticket),
      },
      chatbotRepositoryOverrides: {
        getActiveConversationByUserAndTicketId: jest.fn().mockResolvedValue(null),
        createConversation: jest.fn().mockResolvedValue({
          id: 900,
          createdAt: "2026-04-30T10:00:00.000Z",
          updatedAt: "2026-04-30T10:00:00.000Z",
        }),
        createMessage: jest.fn().mockResolvedValue({
          id: 901,
          role: "assistant",
          content: "Oi! Sou o Resolve Assist.",
          senderType: "bot",
          senderName: "Resolve Assist",
          messageType: "chat",
          customerReadAt: "2026-04-30T10:00:01.000Z",
          createdAt: "2026-04-30T10:00:01.000Z",
        }),
      },
    });

    const response = await chatbotService.getConversation({
      userId: 15,
      ticketId: 44,
    });

    expect(chatbotRepositoryMock.createConversation).toHaveBeenCalledWith({
      userId: 15,
      ticketId: 44,
    });
    expect(chatbotRepositoryMock.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 900,
        role: "assistant",
        senderType: "bot",
      })
    );
    expect(response).toEqual(
      expect.objectContaining({
        status: 200,
        conversation: {
          id: 900,
          createdAt: "2026-04-30T10:00:00.000Z",
          updatedAt: "2026-04-30T10:00:00.000Z",
        },
        messages: [
          expect.objectContaining({
            id: 901,
            senderType: "bot",
            messageType: "chat",
          }),
        ],
        ticket: expect.objectContaining({
          id: 44,
          company: "Resolve Mais",
          subject: "Cobrança",
        }),
      })
    );
  });

  test("clearConversation is idempotent when no active conversation exists", async () => {
    const { chatbotService } = await loadChatbotService({
      chatbotRepositoryOverrides: {
        getActiveConversationByUserId: jest.fn().mockResolvedValue(null),
      },
    });

    const response = await chatbotService.clearConversation({
      userId: 15,
      conversationId: null,
    });

    expect(response).toEqual({
      status: 200,
      message: "Nenhuma conversa ativa para limpar.",
    });
  });

  test("streamMessage rejects blank messages before touching repositories", async () => {
    const { chatbotService, chatbotRepositoryMock } = await loadChatbotService();

    await expect(
      chatbotService.streamMessage({
        userId: 15,
        message: "   ",
        onStart: jest.fn(),
        onToken: jest.fn(),
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Mensagem obrigatoria.",
    });

    expect(chatbotRepositoryMock.createMessage).not.toHaveBeenCalled();
  });

  test("streamMessage stores the user message and falls back when OpenAI is unavailable", async () => {
    const ticket = {
      id: 77,
      status: "aberto",
      description: "App não abre",
      cliente: { id: 15, name: "Maria" },
      empresa: { name: "Resolve Mais" },
      tituloReclamacao: { title: "Aplicativo" },
      createdAt: "2026-04-30T10:00:00.000Z",
      updatedAt: "2026-04-30T10:05:00.000Z",
    };
    const createdUserMessage = {
      id: 501,
      role: "user",
      content: "Preciso de ajuda",
      senderType: "cliente",
      senderName: "Maria",
      senderUserId: 15,
      createdAt: "2026-04-30T10:06:00.000Z",
    };
    const createdAssistantMessage = {
      id: 502,
      role: "assistant",
      content:
        "No momento, o Resolve Assist está indisponível. Seu ticket já foi registrado e logo um atendente assumirá o atendimento neste mesmo chat.",
      senderType: "bot",
      senderName: "Resolve Assist",
      createdAt: "2026-04-30T10:06:05.000Z",
    };
    const onStart = jest.fn();
    const onToken = jest.fn();
    const { chatbotService, chatbotRepositoryMock, realtimeMock, ticketRepositoryMock } =
      await loadChatbotService({
        ticketRepositoryOverrides: {
          getByIdForUser: jest.fn().mockResolvedValue(ticket),
          createUpdate: jest
            .fn()
            .mockResolvedValueOnce({ id: 801 })
            .mockResolvedValueOnce({ id: 802 }),
        },
        chatbotRepositoryOverrides: {
          getActiveConversationByUserAndTicketId: jest.fn().mockResolvedValue({
            id: 700,
            createdAt: "2026-04-30T09:00:00.000Z",
            updatedAt: "2026-04-30T09:10:00.000Z",
          }),
          getMessagesByConversationId: jest.fn().mockResolvedValue([]),
          createMessage: jest
            .fn()
            .mockResolvedValueOnce(createdUserMessage)
            .mockResolvedValueOnce(createdAssistantMessage),
        },
        realtimeOverrides: {
          hasViewerTypeConnected: jest.fn(() => true),
        },
      });

    const response = await chatbotService.streamMessage({
      userId: 15,
      ticketId: 77,
      message: "Preciso de ajuda",
      onStart,
      onToken,
    });

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 700,
        ticketId: 77,
      })
    );
    expect(chatbotRepositoryMock.createMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversationId: 700,
        role: "user",
        senderType: "cliente",
        companyReadAt: expect.any(Date),
      })
    );
    expect(onToken).toHaveBeenCalledWith(
      expect.stringContaining("Resolve Assist está indisponível")
    );
    expect(chatbotRepositoryMock.createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        conversationId: 700,
        role: "assistant",
        senderType: "bot",
        customerReadAt: expect.any(Date),
        companyReadAt: expect.any(Date),
      })
    );
    expect(ticketRepositoryMock.createUpdate).toHaveBeenCalledTimes(2);
    expect(realtimeMock.broadcastTicketEvent).toHaveBeenCalledTimes(2);
    expect(response).toEqual({
      conversationId: 700,
      messageId: 502,
      agent: expect.objectContaining({
        name: "Resolve Assist",
      }),
    });
  });
});
