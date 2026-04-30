import { jest } from "@jest/globals";

const createDefaultAuthServiceMock = () => ({
  login: jest.fn(),
  register: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  validateResetToken: jest.fn(),
});

const createDefaultCompanyServiceMock = () => ({
  getAllCompanies: jest.fn(),
  getPublicCompanyDashboard: jest.fn(),
  getMyCompanyAdmins: jest.fn(),
  getMyCompanyEmployees: jest.fn(),
  getMyCompanyComplaintTitles: jest.fn(),
  updateMyCompanyProfile: jest.fn(),
  addMyCompanyComplaintTitle: jest.fn(),
  addMyCompanyAdmin: jest.fn(),
  addMyCompanyEmployee: jest.fn(),
  updateMyCompanyEmployee: jest.fn(),
  setMyCompanyPrimaryAdmin: jest.fn(),
  removeMyCompanyAdmin: jest.fn(),
  removeMyCompanyEmployee: jest.fn(),
  removeMyCompanyComplaintTitle: jest.fn(),
});

const createDefaultTicketServiceMock = () => ({
  runTicketAutomationCycle: jest.fn(),
  createTicket: jest.fn(),
  getCompanies: jest.fn(),
  getComplaintTitlesByCompany: jest.fn(),
  getUserTickets: jest.fn(),
  getUserClosedTickets: jest.fn(),
  getUserOpenAndPendingTickets: jest.fn(),
  getRecentUpdates: jest.fn(),
  getWorkspaceTickets: jest.fn(),
  getUnreadMessageNotifications: jest.fn(),
  getTicketDetail: jest.fn(),
  getTicketMessages: jest.fn(),
  markTicketMessagesAsRead: jest.fn(),
  sendTicketMessage: jest.fn(),
  acceptTicket: jest.fn(),
  updateTicketStatus: jest.fn(),
  submitTicketEvaluation: jest.fn(),
  updateTicketAssignment: jest.fn(),
  getTicketLogs: jest.fn(),
  getCompanyLogs: jest.fn(),
  getTicketStreamContext: jest.fn(),
});

const createDefaultChatbotServiceMock = () => ({
  getConversation: jest.fn(),
  clearConversation: jest.fn(),
  streamMessage: jest.fn(),
});

const createDefaultUserRepositoryMock = () => ({
  getById: jest.fn(),
  getByEmail: jest.fn(),
  update: jest.fn(),
});

const createDefaultJwtMock = () => ({
  verify: jest.fn(),
});

const createDefaultTicketRealtimeMock = () => ({
  registerTicketSubscriber: jest.fn(() => jest.fn()),
  sendSseEvent: jest.fn(),
});

const toJestMockIfNeeded = (value) =>
  typeof value === "function" && !jest.isMockFunction(value) ? jest.fn(value) : value;

const mergeMocks = (base, overrides = {}) =>
  Object.fromEntries(
    Object.entries({
      ...base,
      ...overrides,
    }).map(([key, value]) => [key, toJestMockIfNeeded(value)])
  );

const loadApp = async ({
  authServiceOverrides = {},
  companyServiceOverrides = {},
  ticketServiceOverrides = {},
  chatbotServiceOverrides = {},
  userRepositoryOverrides = {},
  jwtOverrides = {},
  ticketRealtimeOverrides = {},
  initializeDatabaseImplementation,
  sequelizeCloseImplementation,
} = {}) => {
  jest.resetModules();

  const initializeDatabase = jest.fn(
    initializeDatabaseImplementation || (async () => undefined)
  );
  const sequelizeClose = jest.fn(
    sequelizeCloseImplementation || (async () => undefined)
  );

  const authServiceMock = mergeMocks(
    createDefaultAuthServiceMock(),
    authServiceOverrides
  );
  const companyServiceMock = mergeMocks(
    createDefaultCompanyServiceMock(),
    companyServiceOverrides
  );
  const ticketServiceMock = mergeMocks(
    createDefaultTicketServiceMock(),
    ticketServiceOverrides
  );
  const chatbotServiceMock = mergeMocks(
    createDefaultChatbotServiceMock(),
    chatbotServiceOverrides
  );
  const userRepositoryMock = mergeMocks(
    createDefaultUserRepositoryMock(),
    userRepositoryOverrides
  );
  const jwtMock = mergeMocks(createDefaultJwtMock(), jwtOverrides);
  const ticketRealtimeMock = mergeMocks(
    createDefaultTicketRealtimeMock(),
    ticketRealtimeOverrides
  );

  jest.unstable_mockModule("../app/models/index.js", () => ({
    default: {
      initializeDatabase,
      sequelize: {
        close: sequelizeClose,
      },
    },
  }));
  jest.unstable_mockModule("../app/services/auth.service.js", () => ({
    default: authServiceMock,
  }));
  jest.unstable_mockModule("../app/services/company.service.js", () => ({
    default: companyServiceMock,
  }));
  jest.unstable_mockModule("../app/services/ticket.service.js", () => ({
    default: ticketServiceMock,
  }));
  jest.unstable_mockModule("../app/services/chatbot.service.js", () => ({
    default: chatbotServiceMock,
  }));
  jest.unstable_mockModule("../app/repositories/user.repository.js", () => ({
    default: userRepositoryMock,
  }));
  jest.unstable_mockModule("../app/utils/jwt.js", () => ({
    default: jwtMock,
  }));
  jest.unstable_mockModule("../app/utils/ticketRealtime.js", () => ({
    registerTicketSubscriber: ticketRealtimeMock.registerTicketSubscriber,
    sendSseEvent: ticketRealtimeMock.sendSseEvent,
  }));

  const { default: app } = await import("../index.js");

  return {
    app,
    initializeDatabase,
    sequelizeClose,
    authServiceMock,
    companyServiceMock,
    ticketServiceMock,
    chatbotServiceMock,
    userRepositoryMock,
    jwtMock,
    ticketRealtimeMock,
  };
};

export { loadApp };

export default { loadApp };
