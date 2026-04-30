import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const loadMailerModule = async ({ sendMail = jest.fn().mockResolvedValue(true) } = {}) => {
  jest.resetModules();

  const createTransport = jest.fn(() => ({ sendMail }));

  jest.unstable_mockModule("nodemailer", () => ({
    default: {
      createTransport,
    },
  }));

  const mailer = await import("../../../app/utils/mailer.js");

  return {
    mailer,
    createTransport,
    sendMail,
  };
};

describe("app/utils/mailer", () => {
  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_SECURE;
    delete process.env.MAIL_FROM;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sendPasswordResetEmail returns false when SMTP settings are missing", async () => {
    const { mailer, createTransport } = await loadMailerModule();

    await expect(
      mailer.sendPasswordResetEmail({
        to: "user@example.com",
        name: "User",
        resetUrl: "https://app/reset",
        expiresInMinutes: 30,
      })
    ).resolves.toBe(false);

    expect(createTransport).not.toHaveBeenCalled();
    expect(mailer.isMailerConfigured()).toBe(false);
  });

  test("sendTicketPendingReplyEmail renders the protocol and message metadata", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "2525";
    process.env.SMTP_USER = "mailer";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_SECURE = "true";
    process.env.MAIL_FROM = "support@example.com";

    const { mailer, createTransport, sendMail } = await loadMailerModule();

    await expect(
      mailer.sendTicketPendingReplyEmail({
        to: "customer@example.com",
        recipientName: "Customer",
        senderName: "Resolve Assist",
        companyName: "Resolve Mais",
        ticketId: 42,
        subjectTitle: "Cobrança indevida",
        waitingFor: "retorno do cliente",
      })
    ).resolves.toBe(true);

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 2525,
      secure: true,
      auth: {
        user: "mailer",
        pass: "secret",
      },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "support@example.com",
        to: "customer@example.com",
        subject: "Nova mensagem aguardando resposta - Ticket 33300042",
        text: expect.stringContaining("Cobrança indevida"),
        html: expect.stringContaining("33300042"),
      })
    );
  });
});
