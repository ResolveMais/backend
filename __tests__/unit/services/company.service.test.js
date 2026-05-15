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

const loadCompanyService = async ({
  bcryptOverrides = {},
  companyRepositoryOverrides = {},
  openAiCreateImplementation,
  ticketRepositoryOverrides = {},
  userRepositoryOverrides = {},
  transactionImplementation,
} = {}) => {
  jest.resetModules();

  const bcryptMock = {
    hash: jest.fn(async (value) => `hashed:${value}`),
    ...bcryptOverrides,
  };
  const companyRepositoryMock = {
    getByAdminUserId: jest.fn(),
    getAll: jest.fn(),
    getById: jest.fn(),
    getByName: jest.fn(),
    getByCnpj: jest.fn(),
    update: jest.fn(),
    listAdmins: jest.fn(),
    listComplaintTitles: jest.fn(),
    createComplaintTitle: jest.fn(),
    getComplaintTitleById: jest.fn(),
    countTicketsByComplaintTitle: jest.fn(),
    removeComplaintTitle: jest.fn(),
    clearPrimaryAdmin: jest.fn(),
    addAdminLink: jest.fn(),
    getAdminLink: jest.fn(),
    countAdmins: jest.fn(),
    removeAdminLink: jest.fn(),
    setPrimaryAdmin: jest.fn(),
    ...companyRepositoryOverrides,
  };
  const ticketRepositoryMock = {
    listByCompanyId: jest.fn(),
    ...ticketRepositoryOverrides,
  };
  const userRepositoryMock = {
    listByCompanyAndType: jest.fn(),
    getByEmail: jest.fn(),
    getByCpf: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    ...userRepositoryOverrides,
  };
  const sequelizeMock = {
    transaction: jest.fn(
      transactionImplementation || (async (callback) => callback("tx"))
    ),
  };
  const openAiCreateMock = jest.fn(
    openAiCreateImplementation ||
      (async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: "Leitura da IA",
                summary: "Resumo executivo gerado para a empresa.",
                insights: [
                  {
                    title: "Sinal monitorado",
                    tone: "warning",
                    summary: "A IA encontrou um ponto relevante.",
                    evidence: ["Há dados operacionais para revisão."],
                    recommendedAction: "Revisar o indicador destacado.",
                  },
                ],
              }),
            },
          },
        ],
      }))
  );

  jest.unstable_mockModule("bcrypt", () => ({ default: bcryptMock }));
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
  jest.unstable_mockModule("../../../app/repositories/company.repository.js", () => ({
    default: companyRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/repositories/ticket.repository.js", () => ({
    default: ticketRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/repositories/user.repository.js", () => ({
    default: userRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/models/index.js", () => ({
    default: {
      sequelize: sequelizeMock,
    },
  }));

  const companyService = await import("../../../app/services/company.service.js");

  return {
    companyService,
    bcryptMock,
    companyRepositoryMock,
    openAiCreateMock,
    ticketRepositoryMock,
    userRepositoryMock,
    sequelizeMock,
  };
};

describe("app/services/company.service", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_COMPANY_INSIGHTS_MODEL;
  });

  test("getPublicCompanyDashboard computes public metrics, trust level and feedback highlights", async () => {
    const company = {
      id: 7,
      name: "Resolve Mais",
      description: "Atendimento digital",
      cnpj: "12345678000199",
    };
    const tickets = [
      {
        id: 1,
        status: "aberto",
        customerRating: 5,
        customerFeedback: "Excelente atendimento",
        customerEvaluatedAt: "2026-04-29T10:00:00.000Z",
        resolutionSource: "human",
        cliente: { name: "Maria Silva" },
        tituloReclamacao: { title: "Entrega" },
      },
      {
        id: 2,
        status: "pendente",
        customerRating: 4,
        customerFeedback: "",
        customerEvaluatedAt: "2026-04-28T10:00:00.000Z",
        resolutionSource: "human",
        cliente: { name: "João Souza" },
        tituloReclamacao: { title: "Cobrança" },
      },
      {
        id: 3,
        status: "resolvido",
        customerRating: 5,
        customerFeedback: "Ótimo",
        customerEvaluatedAt: "2026-04-30T10:00:00.000Z",
        resolutionSource: "chatbot",
        cliente: { name: "Ana Costa" },
        tituloReclamacao: { title: "Aplicativo" },
      },
      {
        id: 4,
        status: "fechado",
        customerRating: 4,
        customerFeedback: "Bom",
        customerEvaluatedAt: "2026-04-27T10:00:00.000Z",
        resolutionSource: "human",
        cliente: { name: "Paulo Lima" },
        tituloReclamacao: { title: "Cadastro" },
      },
      {
        id: 5,
        status: "fechado",
        customerRating: 5,
        customerFeedback: "Muito bom",
        customerEvaluatedAt: "2026-04-26T10:00:00.000Z",
        resolutionSource: "human",
        cliente: { name: "Lia Alves" },
        tituloReclamacao: { title: "Fatura" },
      },
    ];
    const { companyService } = await loadCompanyService({
      companyRepositoryOverrides: {
        getById: jest.fn().mockResolvedValue(company),
      },
      ticketRepositoryOverrides: {
        listByCompanyId: jest.fn().mockResolvedValue(tickets),
      },
    });

    const response = await companyService.getPublicCompanyDashboard(7);

    expect(response.status).toBe(200);
    expect(response.company).toEqual(company);
    expect(response.summary).toEqual(
      expect.objectContaining({
        totalTickets: 5,
        openTickets: 1,
        inProgressTickets: 1,
        resolvedTickets: 1,
        closedTickets: 2,
        resolvedOrClosedTickets: 3,
        averageRating: 4.6,
        totalRatings: 5,
        trustLevel: {
          label: "Alta confiabilidade",
          tone: "success",
        },
      })
    );
    expect(response.highlights[0]).toEqual(
      expect.objectContaining({
        ticketId: 3,
        reviewerLabel: "Cliente AC",
      })
    );
  });

  test("updateMyCompanyProfile rejects immutable or conflicting data and persists normalized fields", async () => {
    const { companyService, companyRepositoryMock } = await loadCompanyService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest.fn().mockResolvedValue({
          id: 12,
          name: "Resolve",
          description: "Original",
          cnpj: "12345678000199",
        }),
        getByName: jest.fn().mockResolvedValue(null),
        getById: jest.fn().mockResolvedValue({
          id: 12,
          name: "Resolve Pro",
          description: "Nova descrição",
          aiContext: "Empresa de tecnologia",
          aiInstructions: "Pedir número do pedido",
          aiExamples: "Atraso: solicitar rastreio",
          cnpj: "12345678000199",
        }),
      },
    });

    await expect(
      companyService.updateMyCompanyProfile(9, { cnpj: "99999999000199" })
    ).resolves.toEqual({
      status: 400,
      message: "CNPJ cannot be updated after company registration",
    });

    const response = await companyService.updateMyCompanyProfile(9, {
      name: " Resolve Pro ",
      description: " Nova descrição ",
      aiContext: " Empresa de tecnologia ",
      aiInstructions: " Pedir número do pedido ",
      aiExamples: " Atraso: solicitar rastreio ",
    });

    expect(companyRepositoryMock.update).toHaveBeenCalledWith(12, {
      name: "Resolve Pro",
      description: "Nova descrição",
      aiContext: "Empresa de tecnologia",
      aiInstructions: "Pedir número do pedido",
      aiExamples: "Atraso: solicitar rastreio",
    });
    expect(response).toEqual({
      status: 200,
      message: "Company profile updated successfully",
      company: {
        id: 12,
        name: "Resolve Pro",
        description: "Nova descrição",
        aiContext: "Empresa de tecnologia",
        aiInstructions: "Pedir número do pedido",
        aiExamples: "Atraso: solicitar rastreio",
        cnpj: "12345678000199",
      },
    });
  });

  test("addMyCompanyComplaintTitle blocks duplicates and returns the refreshed title list", async () => {
    const existingTitles = [
      asModel({ id: 1, title: "Cobrança", description: "" }),
    ];
    const refreshedTitles = [
      asModel({ id: 1, title: "Cobrança", description: "" }),
      asModel({ id: 2, title: "Entrega", description: "Atraso" }),
    ];
    const { companyService, companyRepositoryMock } = await loadCompanyService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest.fn().mockResolvedValue({
          id: 12,
          name: "Resolve",
          description: "Original",
          cnpj: "12345678000199",
        }),
        listComplaintTitles: jest
          .fn()
          .mockResolvedValueOnce(existingTitles)
          .mockResolvedValueOnce(existingTitles)
          .mockResolvedValueOnce(refreshedTitles),
      },
    });

    await expect(
      companyService.addMyCompanyComplaintTitle(9, { title: " cobrança " })
    ).resolves.toEqual({
      status: 400,
      message: "Já existe um assunto com esse nome para a empresa",
    });

    const response = await companyService.addMyCompanyComplaintTitle(9, {
      title: "Entrega",
      description: " Atraso ",
    });

    expect(companyRepositoryMock.createComplaintTitle).toHaveBeenCalledWith({
      companyId: 12,
      title: "Entrega",
      description: "Atraso",
    });
    expect(response.status).toBe(201);
    expect(response.complaintTitles).toEqual([
      { id: 1, title: "Cobrança", description: "" },
      { id: 2, title: "Entrega", description: "Atraso" },
    ]);
  });

  test("addMyCompanyEmployee normalizes CPF and hashes the password before persisting", async () => {
    const employees = [
      asModel({
        id: 70,
        name: "Julia",
        email: "julia@example.com",
        phone: "11999999999",
        cpf: "12345678901",
        jobTitle: "Support",
        userType: "funcionario",
        companyId: 12,
      }),
    ];
    const { companyService, bcryptMock, userRepositoryMock } = await loadCompanyService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest.fn().mockResolvedValue({
          id: 12,
          name: "Resolve",
          description: "Original",
          cnpj: "12345678000199",
        }),
      },
      userRepositoryOverrides: {
        getByEmail: jest.fn().mockResolvedValue(null),
        getByCpf: jest.fn().mockResolvedValue(null),
        listByCompanyAndType: jest.fn().mockResolvedValue(employees),
      },
    });

    const response = await companyService.addMyCompanyEmployee(9, {
      name: " Julia ",
      email: " julia@example.com ",
      password: "secret",
      cpf: "123.456.789-01",
      phone: " 11999999999 ",
      jobTitle: " Support ",
    });

    expect(bcryptMock.hash).toHaveBeenCalledWith("secret", 10);
    expect(userRepositoryMock.create).toHaveBeenCalledWith({
      name: "Julia",
      email: "julia@example.com",
      password: "hashed:secret",
      userType: "funcionario",
      cpf: "12345678901",
      cnpj: null,
      phone: "11999999999",
      jobTitle: "Support",
      birthDate: null,
      companyId: 12,
    });
    expect(response.status).toBe(201);
    expect(response.employees[0]).toEqual(
      expect.objectContaining({
        id: 70,
        name: "Julia",
      })
    );
  });

  test("getMyCompanyEmployees applies backend search and pagination", async () => {
    const employeesResult = {
      count: 12,
      rows: [
        asModel({
          id: 70,
          name: "Ana Lima",
          email: "ana@example.com",
          phone: "11999999999",
          cpf: "12345678901",
          avatarUrl: "https://cdn.example.com/ana.png",
          jobTitle: "Analista",
          userType: "funcionario",
          companyId: 12,
        }),
      ],
    };
    const { companyService, userRepositoryMock } = await loadCompanyService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest.fn().mockResolvedValue({
          id: 12,
          name: "Resolve",
          description: "Original",
          cnpj: "12345678000199",
        }),
      },
      userRepositoryOverrides: {
        listByCompanyAndType: jest.fn().mockResolvedValue(employeesResult),
      },
    });

    const response = await companyService.getMyCompanyEmployees(9, {
      search: "ana",
      page: 1,
      pageSize: 5,
    });

    expect(userRepositoryMock.listByCompanyAndType).toHaveBeenCalledWith({
      companyId: 12,
      userType: "funcionario",
      search: "ana",
      limit: 5,
      offset: 0,
    });
    expect(response.employees).toEqual([
      expect.objectContaining({
        id: 70,
        name: "Ana Lima",
        avatarUrl: "https://cdn.example.com/ana.png",
      }),
    ]);
    expect(response.pagination).toEqual({
      page: 1,
      pageSize: 5,
      total: 12,
      totalPages: 3,
    });
  });

  test("getMyCompanyAdmins applies search, role filter and pagination", async () => {
    const adminsResult = {
      count: 1,
      rows: [
        {
          user: {
            id: 501,
            name: "Cilene",
            email: "cilene@example.com",
            phone: null,
            cpf: "12345678901",
            avatarUrl: null,
            jobTitle: "Gestora",
            userType: "empresa",
            companyId: 12,
          },
          isPrimary: true,
        },
      ],
    };
    const { companyService, companyRepositoryMock } = await loadCompanyService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest.fn().mockResolvedValue({
          id: 12,
          name: "Resolve",
          description: "Original",
          cnpj: "12345678000199",
        }),
        listAdmins: jest.fn().mockResolvedValue(adminsResult),
      },
    });

    const response = await companyService.getMyCompanyAdmins(9, {
      search: "cilene",
      adminRole: "primary",
      page: 1,
      pageSize: 10,
    });

    expect(companyRepositoryMock.listAdmins).toHaveBeenCalledWith(12, {
      search: "cilene",
      isPrimary: true,
      limit: 10,
      offset: 0,
    });
    expect(response.admins).toEqual([
      expect.objectContaining({
        id: 501,
        name: "Cilene",
        isPrimary: true,
      }),
    ]);
    expect(response.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  test("getMyCompanyAiInsights uses the dedicated env model and returns structured insights", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_COMPANY_INSIGHTS_MODEL = "gpt-4.1-mini";

    const tickets = [
      {
        id: 1,
        status: "pendente",
        createdAt: "2026-05-12T10:00:00.000Z",
        updatedAt: "2026-05-12T11:00:00.000Z",
        customerRating: 2,
        customerFeedback: "Demorou para responder",
        customerEvaluatedAt: "2026-05-12T12:00:00.000Z",
        resolutionSource: "human",
        tituloReclamacao: { title: "Entrega" },
        assignedEmployee: { id: 55, name: "Ana Martins", jobTitle: "Analista" },
      },
      {
        id: 2,
        status: "fechado",
        createdAt: "2026-05-13T10:00:00.000Z",
        updatedAt: "2026-05-13T12:00:00.000Z",
        customerRating: 5,
        customerFeedback: "Resolveu rápido",
        customerEvaluatedAt: "2026-05-13T13:00:00.000Z",
        resolutionSource: "human",
        tituloReclamacao: { title: "Cobrança" },
        assignedEmployee: { id: 55, name: "Ana Martins", jobTitle: "Analista" },
      },
    ];
    const employees = [
      asModel({
        id: 55,
        name: "Ana Martins",
        email: "ana@example.com",
        phone: "11999999999",
        cpf: "12345678901",
        avatarUrl: null,
        jobTitle: "Analista",
        userType: "funcionario",
        companyId: 12,
      }),
    ];
    const {
      companyService,
      openAiCreateMock,
      userRepositoryMock,
    } = await loadCompanyService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest.fn().mockResolvedValue({
          id: 12,
          name: "Resolve Mais",
          description: "Operação digital",
          aiContext: "Priorizar gargalos de atendimento",
          aiInstructions: "Ser objetivo",
          aiExamples: "Exemplo interno",
          cnpj: "12345678000199",
        }),
      },
      ticketRepositoryOverrides: {
        listByCompanyId: jest.fn().mockResolvedValue(tickets),
      },
      userRepositoryOverrides: {
        listByCompanyAndType: jest.fn().mockResolvedValue(employees),
      },
      openAiCreateImplementation: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: "Fila com atenção em satisfação",
                summary:
                  "A operação está concluindo tickets, mas as notas indicam variação de experiência no atendimento.",
                insights: [
                  {
                    title: "Oscilação nas avaliações",
                    tone: "warning",
                    summary:
                      "As notas recentes mostram diferença grande entre atendimentos bons e ruins.",
                    evidence: [
                      "Há avaliação 2/5 e 5/5 em tickets recentes.",
                      "A mesma atendente concentrou os dois casos analisados.",
                    ],
                    recommendedAction:
                      "Revisar os tickets com menor nota e padronizar o fluxo de resposta.",
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    const response = await companyService.getMyCompanyAiInsights(9);

    expect(userRepositoryMock.listByCompanyAndType).toHaveBeenCalledWith({
      companyId: 12,
      userType: "funcionario",
      search: "",
    });
    expect(openAiCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
      })
    );
    expect(response).toEqual(
      expect.objectContaining({
        status: 200,
        model: "gpt-4.1-mini",
        headline: "Fila com atenção em satisfação",
        insights: [
          expect.objectContaining({
            title: "Oscilação nas avaliações",
            tone: "warning",
          }),
        ],
      })
    );
  });

  test("addMyCompanyAdmin creates the user when needed and links it as primary inside a transaction", async () => {
    const admins = [
      {
        user: {
          id: 501,
          name: "Admin",
          email: "admin@example.com",
          phone: null,
          cpf: "12345678901",
          userType: "funcionario",
          companyId: 12,
        },
        isPrimary: true,
      },
    ];
    const { companyService, companyRepositoryMock, userRepositoryMock } =
      await loadCompanyService({
        companyRepositoryOverrides: {
          getByAdminUserId: jest.fn().mockResolvedValue({
            id: 12,
            name: "Resolve",
            description: "Original",
            cnpj: "12345678000199",
          }),
          getAdminLink: jest.fn().mockResolvedValue(null),
          listAdmins: jest.fn().mockResolvedValue(admins),
        },
        userRepositoryOverrides: {
          getByEmail: jest.fn().mockResolvedValue(null),
          getByCpf: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 501,
            name: "Admin",
            email: "admin@example.com",
            userType: "funcionario",
            companyId: 12,
            cpf: "12345678901",
          }),
          update: jest.fn().mockResolvedValue(undefined),
        },
      });

    const response = await companyService.addMyCompanyAdmin(9, {
      name: "Admin",
      email: "admin@example.com",
      password: "secret",
      cpf: "123.456.789-01",
      makePrimary: true,
    });

    expect(userRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Admin",
        email: "admin@example.com",
        userType: "funcionario",
        companyId: 12,
      }),
      { transaction: "tx" }
    );
    expect(companyRepositoryMock.clearPrimaryAdmin).toHaveBeenCalledWith(12, {
      transaction: "tx",
    });
    expect(companyRepositoryMock.addAdminLink).toHaveBeenCalledWith(
      {
        companyId: 12,
        userId: 501,
        isPrimary: true,
      },
      { transaction: "tx" }
    );
    expect(response.status).toBe(200);
    expect(response.admins).toEqual([
      expect.objectContaining({
        id: 501,
        isPrimary: true,
      }),
    ]);
  });

  test("removeMyCompanyAdmin prevents removing the last admin and reassigns the primary admin when necessary", async () => {
    const { companyService, companyRepositoryMock } = await loadCompanyService({
      companyRepositoryOverrides: {
        getByAdminUserId: jest.fn().mockResolvedValue({
          id: 12,
          name: "Resolve",
          description: "Original",
          cnpj: "12345678000199",
        }),
        getAdminLink: jest
          .fn()
          .mockResolvedValueOnce({
            user: { id: 501, name: "Admin 1" },
            isPrimary: true,
          })
          .mockResolvedValueOnce({
            user: { id: 501, name: "Admin 1" },
            isPrimary: true,
          }),
        countAdmins: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2),
        listAdmins: jest
          .fn()
          .mockResolvedValueOnce([
            { user: { id: 502, name: "Admin 2" }, isPrimary: false },
          ])
          .mockResolvedValueOnce([
            {
              user: {
                id: 502,
                name: "Admin 2",
                email: "admin2@example.com",
                phone: null,
                cpf: "12345678902",
                userType: "funcionario",
                companyId: 12,
              },
              isPrimary: true,
            },
          ]),
      },
    });

    await expect(companyService.removeMyCompanyAdmin(9, 501)).resolves.toEqual({
      status: 400,
      message: "A company must have at least one admin",
    });

    const response = await companyService.removeMyCompanyAdmin(9, 501);

    expect(companyRepositoryMock.removeAdminLink).toHaveBeenCalledWith(
      {
        companyId: 12,
        userId: 501,
      },
      { transaction: "tx" }
    );
    expect(companyRepositoryMock.setPrimaryAdmin).toHaveBeenCalledWith(
      {
        companyId: 12,
        userId: 502,
      },
      { transaction: "tx" }
    );
    expect(response.status).toBe(200);
    expect(response.admins[0]).toEqual(
      expect.objectContaining({
        id: 502,
        isPrimary: true,
      })
    );
  });
});
