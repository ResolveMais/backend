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

const loadAuthService = async ({
  bcryptOverrides = {},
  companyRepositoryOverrides = {},
  passwordResetTokenRepositoryOverrides = {},
  userRepositoryOverrides = {},
  jwtOverrides = {},
  mailerOverrides = {},
  transactionImplementation,
} = {}) => {
  jest.resetModules();

  const bcryptMock = {
    hash: jest.fn(async (value) => `hashed:${value}`),
    compare: jest.fn(async () => true),
    ...bcryptOverrides,
  };
  const companyRepositoryMock = {
    getByCnpj: jest.fn(),
    create: jest.fn(),
    addAdminLink: jest.fn(),
    ...companyRepositoryOverrides,
  };
  const passwordResetTokenRepositoryMock = {
    markAllAsUsedByUserId: jest.fn(),
    create: jest.fn(),
    getActiveByTokenHash: jest.fn(),
    ...passwordResetTokenRepositoryOverrides,
  };
  const userRepositoryMock = {
    getByEmail: jest.fn(),
    getByCpf: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    ...userRepositoryOverrides,
  };
  const jwtMock = {
    sign: jest.fn(() => "jwt-token"),
    ...jwtOverrides,
  };
  const mailerMock = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    ...mailerOverrides,
  };
  const sequelizeMock = {
    transaction: jest.fn(
      transactionImplementation || (async (callback) => callback("tx"))
    ),
  };

  jest.unstable_mockModule("bcrypt", () => ({ default: bcryptMock }));
  jest.unstable_mockModule("../../../app/repositories/company.repository.js", () => ({
    default: companyRepositoryMock,
  }));
  jest.unstable_mockModule(
    "../../../app/repositories/passwordResetToken.repository.js",
    () => ({
      default: passwordResetTokenRepositoryMock,
    })
  );
  jest.unstable_mockModule("../../../app/repositories/user.repository.js", () => ({
    default: userRepositoryMock,
  }));
  jest.unstable_mockModule("../../../app/utils/jwt.js", () => ({
    default: jwtMock,
  }));
  jest.unstable_mockModule("../../../app/utils/mailer.js", () => ({
    sendPasswordResetEmail: mailerMock.sendPasswordResetEmail,
  }));
  jest.unstable_mockModule("../../../app/models/index.js", () => ({
    default: {
      sequelize: sequelizeMock,
    },
  }));

  const authService = await import("../../../app/services/auth.service.js");

  return {
    authService,
    bcryptMock,
    companyRepositoryMock,
    passwordResetTokenRepositoryMock,
    userRepositoryMock,
    jwtMock,
    mailerMock,
    sequelizeMock,
  };
};

describe("app/services/auth.service", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://frontend.example.com";
    process.env.RESET_PASSWORD_EXPIRES_MINUTES = "45";
  });

  afterEach(() => {
    delete process.env.APP_URL;
    delete process.env.RESET_PASSWORD_EXPIRES_MINUTES;
    jest.restoreAllMocks();
  });

  test("login returns a token and removes the password from the response", async () => {
    const storedUser = asModel({
      id: 3,
      name: "Alice",
      email: "alice@example.com",
      password: "hashed-password",
      userType: "cliente",
    });
    const { authService, bcryptMock, jwtMock, userRepositoryMock } =
      await loadAuthService({
        userRepositoryOverrides: {
          getByEmail: jest.fn().mockResolvedValue(storedUser),
        },
        bcryptOverrides: {
          compare: jest.fn().mockResolvedValue(true),
        },
      });

    const response = await authService.login({
      email: "alice@example.com",
      password: "plain-password",
    });

    expect(userRepositoryMock.getByEmail).toHaveBeenCalledWith(
      "alice@example.com",
      true
    );
    expect(bcryptMock.compare).toHaveBeenCalledWith(
      "plain-password",
      "hashed-password"
    );
    expect(jwtMock.sign).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, email: "alice@example.com" })
    );
    expect(response).toEqual({
      status: 200,
      message: "Login successful",
      user: {
        id: 3,
        name: "Alice",
        email: "alice@example.com",
        userType: "cliente",
      },
      token: "jwt-token",
    });
  });

  test("forgotPassword hides whether the e-mail exists when no user is found", async () => {
    const { authService, mailerMock, sequelizeMock } = await loadAuthService({
      userRepositoryOverrides: {
        getByEmail: jest.fn().mockResolvedValue(null),
      },
    });

    const response = await authService.forgotPassword({ email: "missing@example.com" });

    expect(response.status).toBe(200);
    expect(response.message).toContain("link para redefinir a senha");
    expect(sequelizeMock.transaction).not.toHaveBeenCalled();
    expect(mailerMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("forgotPassword creates a token, invalidates previous ones and sends the reset e-mail", async () => {
    jest.spyOn(Date, "now").mockReturnValue(new Date("2026-04-30T10:00:00.000Z").getTime());

    const { authService, mailerMock, passwordResetTokenRepositoryMock } =
      await loadAuthService({
        userRepositoryOverrides: {
          getByEmail: jest.fn().mockResolvedValue({
            id: 5,
            email: "alice@example.com",
            name: "Alice",
          }),
        },
      });

    const response = await authService.forgotPassword({ email: " alice@example.com " });

    expect(response.status).toBe(200);
    expect(passwordResetTokenRepositoryMock.markAllAsUsedByUserId).toHaveBeenCalledWith(5, {
      transaction: "tx",
    });
    expect(passwordResetTokenRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: new Date("2026-04-30T10:45:00.000Z"),
      }),
      { transaction: "tx" }
    );
    expect(mailerMock.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        name: "Alice",
        expiresInMinutes: 45,
        resetUrl: expect.stringContaining("https://frontend.example.com/reset-password?token="),
      })
    );
  });

  test("resetPassword rejects expired reset tokens", async () => {
    const { authService, userRepositoryMock } = await loadAuthService({
      passwordResetTokenRepositoryOverrides: {
        getActiveByTokenHash: jest.fn().mockResolvedValue({
          expiresAt: new Date("2026-04-30T09:00:00.000Z"),
          user: { id: 8 },
        }),
      },
    });

    const response = await authService.resetPassword({
      token: "expired-token",
      newPassword: "123456",
    });

    expect(response.status).toBe(400);
    expect(response.message.toLowerCase()).toContain("token");
    expect(userRepositoryMock.update).not.toHaveBeenCalled();
  });

  test("resetPassword hashes the new password and invalidates all active tokens for the user", async () => {
    const { authService, bcryptMock, passwordResetTokenRepositoryMock, userRepositoryMock } =
      await loadAuthService({
        passwordResetTokenRepositoryOverrides: {
          getActiveByTokenHash: jest.fn().mockResolvedValue({
            expiresAt: new Date("2099-04-30T12:00:00.000Z"),
            user: { id: 8 },
          }),
        },
      });

    const response = await authService.resetPassword({
      token: "valid-token",
      newPassword: "abcdef",
    });

    expect(bcryptMock.hash).toHaveBeenCalledWith("abcdef", 10);
    expect(userRepositoryMock.update).toHaveBeenCalledWith(
      8,
      { password: "hashed:abcdef" },
      { transaction: "tx" }
    );
    expect(passwordResetTokenRepositoryMock.markAllAsUsedByUserId).toHaveBeenCalledWith(8, {
      transaction: "tx",
    });
    expect(response).toEqual({
      status: 200,
      message: "Senha redefinida com sucesso",
    });
  });

  test("validateResetToken returns a success response only for active tokens", async () => {
    const { authService } = await loadAuthService({
      passwordResetTokenRepositoryOverrides: {
        getActiveByTokenHash: jest.fn().mockResolvedValue({
          expiresAt: new Date("2099-04-30T12:00:00.000Z"),
        }),
      },
    });

    await expect(authService.validateResetToken({ token: "valid-token" })).resolves.toEqual({
      status: 200,
      message: "Valid reset token",
    });
  });

  test("register creates a standard customer account with normalized CPF", async () => {
    const createdUser = {
      id: 13,
      name: "Bob",
      email: "bob@example.com",
      password: "hashed:secret",
      userType: "cliente",
      cpf: "12345678901",
      phone: "11999999999",
      birthDate: "1990-01-01",
      companyId: null,
    };
    const { authService, bcryptMock, jwtMock, userRepositoryMock } =
      await loadAuthService({
        userRepositoryOverrides: {
          getByEmail: jest.fn().mockResolvedValue(null),
          getByCpf: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(createdUser),
        },
      });

    const response = await authService.register({
      name: "Bob",
      email: "bob@example.com",
      password: "secret",
      userType: "cliente",
      cpf: "123.456.789-01",
      phone: "11999999999",
      birthDate: "1990-01-01",
    });

    expect(bcryptMock.hash).toHaveBeenCalledWith("secret", 10);
    expect(userRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cpf: "12345678901",
        password: "hashed:secret",
        userType: "cliente",
      }),
      { transaction: undefined }
    );
    expect(jwtMock.sign).toHaveBeenCalledWith(createdUser);
    expect(response).toEqual({
      status: 201,
      message: "User registered successfully",
      user: expect.not.objectContaining({ password: expect.anything() }),
      token: "jwt-token",
    });
  });

  test("register creates a company and its primary admin inside a transaction", async () => {
    const { authService, companyRepositoryMock, userRepositoryMock } =
      await loadAuthService({
        companyRepositoryOverrides: {
          getByCnpj: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 30,
            name: "Resolve Ltda",
            description: "Atendimento",
            cnpj: "12345678000199",
          }),
          addAdminLink: jest.fn().mockResolvedValue(undefined),
        },
        userRepositoryOverrides: {
          getByEmail: jest.fn().mockResolvedValue(null),
          getByCpf: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 31,
            name: "Admin",
            email: "admin@resolve.com",
            password: "hashed:secret",
            userType: "empresa",
            cpf: "12345678901",
            companyId: 30,
          }),
        },
      });

    const response = await authService.register({
      userType: "empresa",
      companyName: " Resolve Ltda ",
      companyDescription: " Atendimento ",
      companyCnpj: "12.345.678/0001-99",
      adminUser: {
        name: "Admin",
        email: "admin@resolve.com",
        password: "secret",
        cpf: "123.456.789-01",
      },
    });

    expect(companyRepositoryMock.create).toHaveBeenCalledWith(
      {
        name: "Resolve Ltda",
        description: "Atendimento",
        cnpj: "12345678000199",
      },
      { transaction: "tx" }
    );
    expect(userRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Admin",
        email: "admin@resolve.com",
        userType: "empresa",
        companyId: 30,
      }),
      { transaction: "tx" }
    );
    expect(companyRepositoryMock.addAdminLink).toHaveBeenCalledWith(
      {
        companyId: 30,
        userId: 31,
        isPrimary: true,
      },
      { transaction: "tx" }
    );
    expect(response).toEqual(
      expect.objectContaining({
        status: 201,
        message: "Company and admin user registered successfully",
        company: {
          id: 30,
          name: "Resolve Ltda",
          description: "Atendimento",
          cnpj: "12345678000199",
        },
      })
    );
  });
});
