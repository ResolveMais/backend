import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import { loadApp } from "../../test-support/loadApp.helper.js";

describe("Integração de chatbot", () => {
  test("GET /api/chatbot/conversation usa o middleware de auth e repassa query ticketId", async () => {
    const { app, chatbotServiceMock } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 9 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 9,
          name: "Cliente",
          userType: "cliente",
        }),
      },
      chatbotServiceOverrides: {
        getConversation: async ({ userId, ticketId }) => ({
          status: 200,
          conversation: { id: 1001 },
          userId,
          ticketId,
        }),
      },
    });

    const response = await request(app)
      .get("/api/chatbot/conversation?ticketId=88")
      .set("Authorization", "Bearer bot-token");

    expect(chatbotServiceMock.getConversation).toHaveBeenCalledWith({
      userId: 9,
      ticketId: "88",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 200,
      conversation: { id: 1001 },
      userId: 9,
      ticketId: "88",
    });
  });

  test("POST /api/chatbot/conversation/clear repassa body opcional ao service", async () => {
    const { app, chatbotServiceMock } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 9 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 9,
          name: "Cliente",
          userType: "cliente",
        }),
      },
      chatbotServiceOverrides: {
        clearConversation: async ({ userId, conversationId, ticketId }) => ({
          status: 200,
          message: "Conversa limpa com sucesso.",
          userId,
          conversationId,
          ticketId,
        }),
      },
    });

    const response = await request(app)
      .post("/api/chatbot/conversation/clear")
      .set("Authorization", "Bearer bot-token")
      .send({ conversationId: 13, ticketId: 77 });

    expect(chatbotServiceMock.clearConversation).toHaveBeenCalledWith({
      userId: 9,
      conversationId: 13,
      ticketId: 77,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 200,
      message: "Conversa limpa com sucesso.",
      userId: 9,
      conversationId: 13,
      ticketId: 77,
    });
  });

  test("POST /api/chatbot/message/stream responde 400 antes do streaming quando a mensagem está vazia", async () => {
    const { app } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 9 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 9,
          name: "Cliente",
          userType: "cliente",
        }),
      },
    });

    const response = await request(app)
      .post("/api/chatbot/message/stream")
      .set("Authorization", "Bearer bot-token")
      .send({ message: "   " });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      message: "Mensagem obrigatoria.",
    });
  });

  test("POST /api/chatbot/message/stream escreve eventos SSE start, token e done", async () => {
    const { app, chatbotServiceMock } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 9 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 9,
          name: "Cliente",
          userType: "cliente",
        }),
      },
      chatbotServiceOverrides: {
        streamMessage: async ({
          userId,
          message,
          conversationId,
          ticketId,
          onStart,
          onToken,
        }) => {
          onStart({ conversationId: 41, userId, ticketId });
          onToken(`eco:${message}`);
          return { conversationId: 41, messageId: 99, conversationIdFromBody: conversationId };
        },
      },
    });

    const response = await request(app)
      .post("/api/chatbot/message/stream")
      .set("Authorization", "Bearer bot-token")
      .send({
        message: "Olá",
        conversationId: 7,
        ticketId: 88,
      });

    expect(chatbotServiceMock.streamMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        message: "Olá",
        conversationId: 7,
        ticketId: 88,
        abortSignal: expect.any(AbortSignal),
        onStart: expect.any(Function),
        onToken: expect.any(Function),
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toContain("event: start");
    expect(response.text).toContain('"conversationId":41');
    expect(response.text).toContain("event: token");
    expect(response.text).toContain('"token":"eco:Olá"');
    expect(response.text).toContain("event: done");
    expect(response.text).toContain('"messageId":99');
  });

  test("POST /api/chatbot/message/stream serializa erro do service como evento SSE", async () => {
    const { app } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 9 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 9,
          name: "Cliente",
          userType: "cliente",
        }),
      },
      chatbotServiceOverrides: {
        streamMessage: async () => {
          const error = new Error("Ticket não encontrado.");
          error.statusCode = 404;
          throw error;
        },
      },
    });

    const response = await request(app)
      .post("/api/chatbot/message/stream")
      .set("Authorization", "Bearer bot-token")
      .send({ message: "Olá" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toContain("event: error");
    expect(response.text).toContain('"status":404');
    expect(response.text).toContain('"message":"Ticket não encontrado."');
  });
});
