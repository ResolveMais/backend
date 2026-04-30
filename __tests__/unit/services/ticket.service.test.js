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

const loadTicketService = async ({
  chatbotRepositoryOverrides = {},
  companyRepositoryOverrides = {},
  ticketRepositoryOverrides = {},
  userRepositoryOverrides = {},
  mailerOverrides = {},
  realtimeOverrides = {},
  transactionImplementation,
} = {}) => {
  jest.resetModules();

  const chatbotRepositoryMock = {
    getOrCreateConversationByTicket: jest.fn(),
    createMessage: jest.fn(),
    listMessagesPendingReminder: jest.fn(),
    markReminderSent: jest.fn(),
    ...chatbotRepositoryOverrides,
  };
  const companyRepositoryMock = {
    getAll: jest.fn(),
    getByAdminUserId: jest.fn(),
    getById: jest.fn(),
    listAdmins: jest.fn(),
    ...companyRepositoryOverrides,
  };
  const ticketRepositoryMock = {
    create: jest.fn(),
    getOpenAndPendingByUserId: jest.fn(),
    getByUserId: jest.fn(),
    getClosedByUserId: jest.fn(),
    listByCompanyId: jest.fn(),
    getByIdForCompany: jest.fn(),
    getByIdForUser: jest.fn(),
    updateTicketById: jest.fn(),
    createUpdate: jest.fn(),
    listInactiveOpenTickets: jest.fn(),
    ...ticketRepositoryOverrides,
  };
  const userRepositoryMock = {
    getById: jest.fn(),
    ...userRepositoryOverrides,
  };
  const mailerMock = {
    sendTicketPendingReplyEmail: jest.fn().mockResolvedValue(true),
    ...mailerOverrides,
  };
  const realtimeMock = {
    broadcastTicketEvent: jest.fn(),
    hasViewerTypeConnected: jest.fn(() => false),
    ...realtimeOverrides,
  };
  const sequelizeMock = {
    transaction: jest.fn(
      transactionImplementation || (async (callback) => callback("tx"))
    ),
  };

  jest.unstable_mockModule("../../../app/repositories/chatbot.repository.js", () => ({
    default: chatbotRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/repositories/company.repository.js", () => ({
    default: companyRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/repositories/ticket.repository.js", () => ({
    default: ticketRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/repositories/user.repository.js", () => ({
    default: userRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/utils/mailer.js", () => ({
    sendTicketPendingReplyEmail: mailerMock.sendTicketPendingReplyEmail,
  }));
  jest.unstable_mockModule("../../../app/utils/ticketRealtime.js", () => ({
    broadcastTicketEvent: realtimeMock.broadcastTicketEvent,
    hasViewerTypeConnected: realtimeMock.hasViewerTypeConnected,
  }));
  jest.unstable_mockModule("../../../app/models/index.js", () => ({
    default: {
      sequelize: sequelizeMock,
    },
  }));

  const ticketServiceModule = await import("../../../app/services/ticket.service.js");

  return {
    ticketService: ticketServiceModule.default,
    chatbotRepositoryMock,
    companyRepositoryMock,
    ticketRepositoryMock,
    userRepositoryMock,
    mailerMock,
    realtimeMock,
    sequelizeMock,
  };
};

describe("app/services/ticket.service", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("createTicket validates required fields and trims the stored description", async () => {
    const { ticketService, ticketRepositoryMock } = await loadTicketService({
      ticketRepositoryOverrides: {
        create: jest.fn().mockResolvedValue({
          id: 44,
          description: "Problema ao acessar a conta",
          status: "aberto",
          createdAt: "2026-04-30T10:00:00.000Z",
        }),
      },
    });

    await expect(
      ticketService.createTicket({
        description: "   ",
        userId: 1,
        companyId: 2,
        complaintTitleId: 3,
      })
    ).resolves.toEqual({
      status: 400,
      message: "Descrição é obrigatória",
    });

    const response = await ticketService.createTicket({
      description: " Problema ao acessar a conta ",
      userId: 1,
      companyId: 2,
      complaintTitleId: 3,
    });

    expect(ticketRepositoryMock.create).toHaveBeenCalledWith({
      description: "Problema ao acessar a conta",
      userId: 1,
      companyId: 2,
      complaintTitleId: 3,
    });
    expect(response).toEqual({
      status: 201,
      message: "Ticket criado com sucesso",
      ticket: {
        id: 44,
        descricao: "Problema ao acessar a conta",
        status: "aberto",
        criadoEm: "2026-04-30T10:00:00.000Z",
      },
    });
  });

  test("getWorkspaceTickets filters employee visibility to open tickets or their assigned tickets", async () => {
    const visibleOpen = {
      id: 1,
      status: "aberto",
      description: "Aberto",
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
      cliente: { id: 4, name: "Maria" },
    };
    const visibleAssigned = {
      id: 2,
      status: "pendente",
      description: "Meu ticket",
      assignedUserId: 55,
      assignedEmployee: { id: 55, name: "Atendente A" },
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 11, title: "Entrega" },
      cliente: { id: 5, name: "João" },
    };
    const hiddenAssigned = {
      id: 3,
      status: "pendente",
      description: "Ticket de outro atendente",
      assignedUserId: 66,
      assignedEmployee: { id: 66, name: "Atendente B" },
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 12, title: "App" },
      cliente: { id: 6, name: "Ana" },
    };
    const { ticketService } = await loadTicketService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest.fn().mockResolvedValue(null),
        getById: jest.fn().mockResolvedValue({ id: 22, name: "Resolve Mais" }),
      },
      ticketRepositoryOverrides: {
        listByCompanyId: jest
          .fn()
          .mockResolvedValueOnce([visibleOpen, visibleAssigned, hiddenAssigned])
          .mockResolvedValueOnce([visibleOpen, visibleAssigned, hiddenAssigned]),
      },
    });

    const response = await ticketService.getWorkspaceTickets(
      {
        id: 55,
        userType: "funcionario",
        companyId: 22,
      },
      { scope: "active" }
    );

    expect(response.status).toBe(200);
    expect(response.scope).toBe("employee");
    expect(response.tickets.map((ticket) => ticket.id)).toEqual([1, 2]);
    expect(response.summary).toEqual({
      total: 2,
      aberto: 1,
      pendente: 1,
      resolvido: 0,
      fechado: 0,
      semResponsavel: 1,
    });
  });

  test("sendTicketMessage enforces channel rules and marks the counterpart as read when connected", async () => {
    const customerTicket = {
      id: 91,
      status: "aberto",
      description: "Sem resposta",
      cliente: { id: 4, name: "Maria" },
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
    };
    const humanTicket = {
      id: 92,
      status: "pendente",
      description: "Em atendimento",
      assignedUserId: 55,
      cliente: { id: 4, name: "Maria" },
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
    };
    const { ticketService, chatbotRepositoryMock, realtimeMock, ticketRepositoryMock } =
      await loadTicketService({
        companyRepositoryOverrides: {
          getByAdminUserId: jest.fn().mockResolvedValue(null),
          getById: jest.fn().mockResolvedValue({ id: 22, name: "Resolve Mais" }),
        },
        ticketRepositoryOverrides: {
          getByIdForUser: jest.fn().mockResolvedValue(customerTicket),
          getByIdForCompany: jest.fn().mockResolvedValue(humanTicket),
          createUpdate: jest.fn().mockResolvedValue({
            id: 300,
            message: "Atendente respondeu",
            type: "message",
            createdAt: "2026-04-30T10:00:00.000Z",
          }),
        },
        chatbotRepositoryOverrides: {
          getOrCreateConversationByTicket: jest.fn().mockResolvedValue({ id: 888 }),
          createMessage: jest.fn().mockResolvedValue({
            id: 889,
            role: "assistant",
            content: "Olá, cliente",
            senderType: "funcionario",
            senderName: "Atendente A",
            senderUserId: 55,
            createdAt: "2026-04-30T10:01:00.000Z",
          }),
        },
        realtimeOverrides: {
          hasViewerTypeConnected: jest.fn(({ viewerType }) => viewerType === "customer"),
        },
      });

    await expect(
      ticketService.sendTicketMessage(
        { id: 4, userType: "cliente" },
        91,
        "Posso responder aqui?"
      )
    ).resolves.toEqual({
      status: 400,
      message:
        "Enquanto o ticket estiver aberto, a conversa inicial deve seguir pelo chatbot.",
    });

    const response = await ticketService.sendTicketMessage(
      { id: 55, name: "Atendente A", userType: "funcionario", companyId: 22 },
      92,
      " Já estamos analisando "
    );

    expect(chatbotRepositoryMock.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 888,
        role: "assistant",
        content: "Já estamos analisando",
        customerReadAt: expect.any(Date),
        companyReadAt: null,
      })
    );
    expect(realtimeMock.broadcastTicketEvent).toHaveBeenCalledTimes(2);
    expect(ticketRepositoryMock.createUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 92,
        type: "message",
      })
    );
    expect(response.status).toBe(201);
  });

  test("acceptTicket moves an open ticket to human service and assigns the employee", async () => {
    const originalTicket = {
      id: 50,
      status: "aberto",
      description: "Preciso de ajuda",
      cliente: { id: 4, name: "Maria" },
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
    };
    const updatedTicket = {
      ...originalTicket,
      status: "pendente",
      assignedUserId: 55,
      assignedEmployee: { id: 55, name: "Atendente A", userType: "funcionario" },
      acceptedAt: "2026-04-30T10:00:00.000Z",
    };
    const { ticketService, ticketRepositoryMock, chatbotRepositoryMock, realtimeMock } =
      await loadTicketService({
        companyRepositoryOverrides: {
          getByAdminUserId: jest.fn().mockResolvedValue(null),
          getById: jest.fn().mockResolvedValue({ id: 22, name: "Resolve Mais" }),
        },
        ticketRepositoryOverrides: {
          getByIdForCompany: jest
            .fn()
            .mockResolvedValueOnce(originalTicket)
            .mockResolvedValueOnce(updatedTicket),
          updateTicketById: jest.fn().mockResolvedValue(undefined),
          createUpdate: jest
            .fn()
            .mockResolvedValueOnce({ id: 1, type: "acceptance", message: "Aceito" })
            .mockResolvedValueOnce({ id: 2, type: "assignment", message: "Atribuído" }),
        },
        userRepositoryOverrides: {
          getById: jest.fn().mockResolvedValue({
            id: 55,
            name: "Atendente A",
            userType: "funcionario",
            companyId: 22,
          }),
        },
        chatbotRepositoryOverrides: {
          getOrCreateConversationByTicket: jest.fn().mockResolvedValue({ id: 77 }),
          createMessage: jest.fn().mockResolvedValue({
            id: 78,
            role: "system",
            content: "Atendimento humano iniciado",
            senderType: "sistema",
            senderName: "Resolve Mais",
            createdAt: "2026-04-30T10:00:00.000Z",
          }),
        },
      });

    const response = await ticketService.acceptTicket(
      { id: 55, name: "Atendente A", userType: "funcionario", companyId: 22 },
      50
    );

    expect(ticketRepositoryMock.updateTicketById).toHaveBeenCalledWith(
      50,
      expect.objectContaining({
        status: "pendente",
        assignedUserId: 55,
        acceptedAt: expect.any(Date),
      })
    );
    expect(chatbotRepositoryMock.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 77,
        role: "system",
      })
    );
    expect(realtimeMock.broadcastTicketEvent).toHaveBeenCalledTimes(4);
    expect(response).toEqual(
      expect.objectContaining({
        status: 200,
        message: "Ticket aceito com sucesso.",
        ticket: expect.objectContaining({
          id: 50,
          status: "pendente",
        }),
      })
    );
  });

  test("updateTicketAssignment allows company admins to assign an employee and move the ticket to pending", async () => {
    const originalTicket = {
      id: 60,
      status: "aberto",
      description: "Aguardando análise",
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
      cliente: { id: 4, name: "Maria" },
      assignedEmployee: null,
    };
    const updatedTicket = {
      ...originalTicket,
      status: "pendente",
      assignedUserId: 55,
      assignedEmployee: { id: 55, name: "Atendente A", userType: "funcionario" },
    };
    const { ticketService, ticketRepositoryMock, userRepositoryMock, realtimeMock } =
      await loadTicketService({
        companyRepositoryOverrides: {
          getByAdminUserId: jest.fn().mockResolvedValue({ id: 22, name: "Resolve Mais" }),
        },
        ticketRepositoryOverrides: {
          getByIdForCompany: jest
            .fn()
            .mockResolvedValueOnce(originalTicket)
            .mockResolvedValueOnce(updatedTicket),
          createUpdate: jest
            .fn()
            .mockResolvedValueOnce({ id: 10, type: "assignment" })
            .mockResolvedValueOnce({ id: 11, type: "status_change" }),
        },
        userRepositoryOverrides: {
          getById: jest.fn().mockResolvedValue({
            id: 55,
            name: "Atendente A",
            userType: "funcionario",
            companyId: 22,
            email: "atendente@example.com",
          }),
        },
        chatbotRepositoryOverrides: {
          getOrCreateConversationByTicket: jest.fn().mockResolvedValue({ id: 90 }),
          createMessage: jest.fn().mockResolvedValue({
            id: 91,
            role: "system",
            content: "Responsável definido",
            senderType: "sistema",
            senderName: "Resolve Mais",
            createdAt: "2026-04-30T10:00:00.000Z",
          }),
        },
      });

    const response = await ticketService.updateTicketAssignment(
      { id: 1, name: "Admin", userType: "empresa" },
      60,
      55
    );

    expect(userRepositoryMock.getById).toHaveBeenCalledWith(55);
    expect(ticketRepositoryMock.updateTicketById).toHaveBeenCalledWith(
      60,
      expect.objectContaining({
        assignedUserId: 55,
        status: "pendente",
        acceptedAt: expect.any(Date),
      })
    );
    expect(realtimeMock.broadcastTicketEvent).toHaveBeenCalledTimes(5);
    expect(response.status).toBe(200);
  });

  test("updateTicketStatus enforces role-based transitions and persists resolution metadata", async () => {
    const customerTicket = {
      id: 70,
      status: "aberto",
      description: "Chatbot resolveu",
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
      cliente: { id: 4, name: "Maria" },
    };
    const resolvedByCustomer = {
      ...customerTicket,
      status: "resolvido",
      resolutionSource: "chatbot",
    };
    const employeeTicket = {
      id: 71,
      status: "pendente",
      description: "Atendente resolveu",
      assignedUserId: 55,
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
      cliente: { id: 4, name: "Maria" },
      assignedEmployee: { id: 55, name: "Atendente A" },
    };
    const resolvedByEmployee = {
      ...employeeTicket,
      status: "resolvido",
      resolutionSource: "human",
    };
    const { ticketService, ticketRepositoryMock } = await loadTicketService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        getById: jest.fn().mockResolvedValue({ id: 22, name: "Resolve Mais" }),
      },
      ticketRepositoryOverrides: {
        getByIdForUser: jest
          .fn()
          .mockResolvedValueOnce(customerTicket)
          .mockResolvedValueOnce(resolvedByCustomer),
        getByIdForCompany: jest
          .fn()
          .mockResolvedValueOnce(employeeTicket)
          .mockResolvedValueOnce(resolvedByEmployee),
        createUpdate: jest
          .fn()
          .mockResolvedValueOnce({ id: 21, type: "resolution" })
          .mockResolvedValueOnce({ id: 22, type: "resolution" }),
      },
      chatbotRepositoryOverrides: {
        getOrCreateConversationByTicket: jest.fn().mockResolvedValue({ id: 99 }),
        createMessage: jest.fn().mockResolvedValue({
          id: 100,
          role: "system",
          content: "Status alterado",
          senderType: "sistema",
          senderName: "Resolve Mais",
          createdAt: "2026-04-30T10:00:00.000Z",
        }),
      },
    });

    const customerResponse = await ticketService.updateTicketStatus(
      { id: 4, name: "Maria", userType: "cliente" },
      70,
      "resolvido"
    );

    expect(ticketRepositoryMock.updateTicketById).toHaveBeenNthCalledWith(
      1,
      70,
      expect.objectContaining({
        status: "resolvido",
        resolutionSource: "chatbot",
        resolvedAt: expect.any(Date),
      })
    );
    expect(customerResponse.status).toBe(200);

    const employeeResponse = await ticketService.updateTicketStatus(
      { id: 55, name: "Atendente A", userType: "funcionario", companyId: 22 },
      71,
      "resolvido"
    );

    expect(ticketRepositoryMock.updateTicketById).toHaveBeenNthCalledWith(
      2,
      71,
      expect.objectContaining({
        status: "resolvido",
        resolutionSource: "human",
        resolvedAt: expect.any(Date),
      })
    );
    expect(employeeResponse.status).toBe(200);
  });

  test("submitTicketEvaluation persists the score only for resolved customer tickets", async () => {
    const resolvedTicket = {
      id: 73,
      status: "resolvido",
      description: "Resolvido",
      resolutionSource: "human",
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
      cliente: { id: 4, name: "Maria" },
    };
    const evaluatedTicket = {
      ...resolvedTicket,
      customerRating: 5,
      customerFeedback: "Atendimento excelente",
      customerEvaluatedAt: "2026-04-30T10:20:00.000Z",
    };
    const { ticketService, ticketRepositoryMock, realtimeMock } = await loadTicketService({
      ticketRepositoryOverrides: {
        getByIdForUser: jest
          .fn()
          .mockResolvedValueOnce(resolvedTicket)
          .mockResolvedValueOnce(evaluatedTicket),
        createUpdate: jest.fn().mockResolvedValue({
          id: 500,
          type: "evaluation",
          createdAt: "2026-04-30T10:20:00.000Z",
        }),
      },
    });

    const response = await ticketService.submitTicketEvaluation(
      { id: 4, userType: "cliente" },
      73,
      { rating: 5, comment: " Atendimento excelente " }
    );

    expect(ticketRepositoryMock.updateTicketById).toHaveBeenCalledWith(
      73,
      expect.objectContaining({
        customerRating: 5,
        customerFeedback: "Atendimento excelente",
        customerEvaluatedAt: expect.any(Date),
      })
    );
    expect(realtimeMock.broadcastTicketEvent).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });

  test("runTicketAutomationCycle closes inactive tickets and sends reminder e-mails for pending replies", async () => {
    const inactiveTicket = {
      id: 80,
      status: "aberto",
      empresa: { id: 22, name: "Resolve Mais" },
      tituloReclamacao: { id: 10, title: "Cobrança" },
      cliente: { id: 4, name: "Maria" },
    };
    const pendingMessage = {
      id: 900,
      senderType: "cliente",
      senderName: "Maria",
      conversation: {
        ticket: {
          id: 81,
          company_id: 22,
          empresa: { id: 22, name: "Resolve Mais" },
          tituloReclamacao: { title: "Entrega" },
          cliente: {
            id: 4,
            name: "Maria",
            email: "maria@example.com",
          },
          assignedEmployee: {
            id: 55,
            name: "Atendente A",
            email: "atendente@example.com",
          },
        },
      },
    };
    const { ticketService, chatbotRepositoryMock, ticketRepositoryMock, mailerMock, realtimeMock } =
      await loadTicketService({
        ticketRepositoryOverrides: {
          listInactiveOpenTickets: jest.fn().mockResolvedValue([inactiveTicket]),
          createUpdate: jest.fn().mockResolvedValue({
            id: 910,
            type: "automation",
          }),
        },
        chatbotRepositoryOverrides: {
          getOrCreateConversationByTicket: jest
            .fn()
            .mockResolvedValueOnce({ id: 82 })
            .mockResolvedValueOnce({ id: 83 }),
          createMessage: jest
            .fn()
            .mockResolvedValueOnce({
              id: 84,
              role: "system",
              senderType: "sistema",
              senderName: "Resolve Mais",
              content: "Fechado automaticamente",
            })
            .mockResolvedValueOnce({
              id: 85,
              role: "system",
            }),
          listMessagesPendingReminder: jest.fn().mockResolvedValue([pendingMessage]),
          markReminderSent: jest.fn().mockResolvedValue(undefined),
        },
      });

    await ticketService.runTicketAutomationCycle();

    expect(ticketRepositoryMock.updateTicketById).toHaveBeenCalledWith(
      80,
      expect.objectContaining({
        status: "fechado",
        closedAt: expect.any(Date),
        autoClosedAt: expect.any(Date),
      }),
      { transaction: "tx" }
    );
    expect(mailerMock.sendTicketPendingReplyEmail).toHaveBeenCalledWith({
      to: "atendente@example.com",
      recipientName: "Atendente A",
      senderName: "Maria",
      companyName: "Resolve Mais",
      ticketId: 81,
      subjectTitle: "Entrega",
      waitingFor: "retorno da empresa",
    });
    expect(chatbotRepositoryMock.markReminderSent).toHaveBeenCalledWith({
      messageId: 900,
    });
    expect(realtimeMock.broadcastTicketEvent).toHaveBeenCalledWith(
      80,
      "status_changed",
      {
        ticketId: 80,
        status: "fechado",
      }
    );
  });
});
