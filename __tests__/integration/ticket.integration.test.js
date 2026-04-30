import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import { loadApp } from "../../test-support/loadApp.helper.js";

describe("Integração de tickets", () => {
  test("router de tickets exige autenticação antes de chegar ao controller", async () => {
    const { app } = await loadApp();

    const response = await request(app).get("/api/tickets/companies");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "No token provided" });
  });

  test("GET /api/tickets/workspace encaminha usuário autenticado e query scope para o service", async () => {
    const { app, ticketServiceMock } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 18 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 18,
          name: "Atendente",
          userType: "funcionario",
          companyId: 9,
        }),
      },
      ticketServiceOverrides: {
        getWorkspaceTickets: async (user, options) => ({
          status: 200,
          scope: options.scope,
          userId: user.id,
          tickets: [],
        }),
      },
    });

    const response = await request(app)
      .get("/api/tickets/workspace?scope=closed")
      .set("Authorization", "Bearer support-token");

    expect(ticketServiceMock.getWorkspaceTickets).toHaveBeenCalledWith(
      {
        id: 18,
        name: "Atendente",
        userType: "funcionario",
        companyId: 9,
      },
      { scope: "closed" }
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 200,
      scope: "closed",
      userId: 18,
      tickets: [],
    });
  });

  test("POST /api/tickets/:ticketId/accept encaminha params, body e req.user corretamente", async () => {
    const { app, ticketServiceMock } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 18 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 18,
          name: "Atendente",
          userType: "funcionario",
          companyId: 9,
        }),
      },
      ticketServiceOverrides: {
        acceptTicket: async (user, ticketId, assignedUserId) => ({
          status: 200,
          message: "Ticket aceito com sucesso.",
          userId: user.id,
          ticketId,
          assignedUserId,
        }),
      },
    });

    const response = await request(app)
      .post("/api/tickets/45/accept")
      .set("Authorization", "Bearer support-token")
      .send({ assignedUserId: 31 });

    expect(ticketServiceMock.acceptTicket).toHaveBeenCalledWith(
      {
        id: 18,
        name: "Atendente",
        userType: "funcionario",
        companyId: 9,
      },
      "45",
      31
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 200,
      message: "Ticket aceito com sucesso.",
      userId: 18,
      ticketId: "45",
      assignedUserId: 31,
    });
  });

  test("PATCH /api/tickets/:ticketId/status replica o retorno do service", async () => {
    const { app, ticketServiceMock } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 4 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 4,
          name: "Cliente",
          userType: "cliente",
        }),
      },
      ticketServiceOverrides: {
        updateTicketStatus: async (_user, ticketId, status) => ({
          status: 400,
          message: `Transição inválida para ${status} no ticket ${ticketId}`,
        }),
      },
    });

    const response = await request(app)
      .patch("/api/tickets/77/status")
      .set("Authorization", "Bearer customer-token")
      .send({ status: "fechado" });

    expect(ticketServiceMock.updateTicketStatus).toHaveBeenCalledWith(
      {
        id: 4,
        name: "Cliente",
        userType: "cliente",
      },
      "77",
      "fechado"
    );
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      message: "Transição inválida para fechado no ticket 77",
    });
  });
});
