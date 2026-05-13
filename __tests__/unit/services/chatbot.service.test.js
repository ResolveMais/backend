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
  openAiCreateMock = jest.fn(),
} = {}) => {
  jest.resetModules();

  const chatbotRepositoryMock = {
    getConversationByIdForUser: jest.fn(),
    getActiveConversationByUserAndTicketId: jest.fn(),
    createConversation: jest.fn(),
    getActiveConversationByUserId: jest.fn(),
    getMessagesByConversationId: jest.fn(),
    createMessage: jest.fn(),
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
            create: openAiCreateMock,
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
    openAiCreateMock,
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
        content: "Oi! Sou o Resolve Assist. Estou aqui para ajudar com este chamado e responder suas dúvidas com base nas informações disponíveis.",
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
        "No momento, o Resolve Assist está indisponível e não consigo responder com segurança agora.",
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

  test("streamMessage sends company AI context to OpenAI when the ticket has company settings", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const ticket = {
      id: 88,
      status: "aberto",
      description: "Pedido atrasado",
      cliente: { id: 15, name: "Maria" },
      assignedEmployee: { id: 22, name: "Jacinto" },
      empresa: {
        name: "Resolve Mais",
        description: "Atendimento digital",
        aiContext: "Empresa de tecnologia com suporte para pedidos online.",
        aiInstructions: "Sempre peça o número do pedido antes de orientar sobre entrega.",
        aiExamples: "Atraso na entrega: informar apenas dados de rastreio registrados no ticket.",
      },
      tituloReclamacao: { title: "Entrega" },
      createdAt: "2026-04-30T10:00:00.000Z",
      updatedAt: "2026-04-30T10:05:00.000Z",
    };
    const openAiCreateMock = jest.fn().mockResolvedValue([
      { choices: [{ delta: { content: "Claro, posso ajudar." } }] },
    ]);
    const { chatbotService, openAiCreateMock: capturedOpenAiCreateMock } =
      await loadChatbotService({
        openAiCreateMock,
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
            .mockResolvedValueOnce({
              id: 501,
              role: "user",
              content: "Meu pedido atrasou",
              senderType: "cliente",
              senderName: "Maria",
              senderUserId: 15,
              createdAt: "2026-04-30T10:06:00.000Z",
            })
            .mockResolvedValueOnce({
              id: 502,
              role: "assistant",
              content: "Claro, posso ajudar.",
              senderType: "bot",
              senderName: "Resolve Assist",
              createdAt: "2026-04-30T10:06:05.000Z",
            }),
        },
      });

    await chatbotService.streamMessage({
      userId: 15,
      ticketId: 88,
      message: "Meu pedido atrasou",
      onStart: jest.fn(),
      onToken: jest.fn(),
    });

    const [{ messages }] = capturedOpenAiCreateMock.mock.calls[0];
    const companyContextMessage = messages.find((message) =>
      message.content.includes("Contexto interno cadastrado pela empresa")
    );

    expect(companyContextMessage.content).toContain(
      "Empresa de tecnologia com suporte para pedidos online."
    );
    expect(companyContextMessage.content).toContain(
      "Sempre peça o número do pedido"
    );
    expect(companyContextMessage.content).toContain(
      "Atraso na entrega: informar apenas dados de rastreio"
    );
    expect(companyContextMessage.content).toContain(
      "não tome iniciativa, não prometa atendimento humano"
    );
    expect(companyContextMessage.content).toContain(
      "Processo de atendimento deste ticket"
    );
    expect(companyContextMessage.content).toContain(
      "A conversa do ticket acontece neste mesmo chat"
    );
    expect(companyContextMessage.content).toContain(
      "canal do chamado é este mesmo chat"
    );
    expect(companyContextMessage.content).toContain(
      "Responsável registrado: Jacinto"
    );

    const basePromptMessage = messages[0];
    expect(basePromptMessage.content).toContain(
      "Não tome iniciativa pelo usuário"
    );
    expect(basePromptMessage.content).toContain(
      "responda cada parte relevante da mensagem"
    );
    expect(basePromptMessage.content).toContain(
      "Se o usuário pedir para redirecionar"
    );
    expect(basePromptMessage.content).toContain(
      "sem soar seco ou ríspido"
    );
    expect(basePromptMessage.content).toContain(
      "Não use 'Pelas informações registradas' como início padrão"
    );
    expect(basePromptMessage.content).toContain(
      "Quando a informação solicitada estiver no contexto, responda diretamente"
    );
    expect(basePromptMessage.content).toContain(
      "ofereça passos gerais e seguros"
    );
    expect(basePromptMessage.content).toContain(
      "O ticket já faz parte do contexto desde o primeiro contato"
    );
    expect(basePromptMessage.content).toContain(
      "como faço para falar com ele?"
    );
    expect(basePromptMessage.content).toContain(
      "Não peça para o usuário repetir informações"
    );
    expect(basePromptMessage.content).toContain(
      "diga claramente que não sabe"
    );
  });
});
