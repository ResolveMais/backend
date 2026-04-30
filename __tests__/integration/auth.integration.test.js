import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import { loadApp } from "../../test-support/loadApp.helper.js";

describe("Integração de autenticação", () => {
  test("POST /api/auth/login encaminha payload para o service e devolve o contrato HTTP", async () => {
    const { app, authServiceMock } = await loadApp({
      authServiceOverrides: {
        login: async ({ email, password }) => ({
          status: 200,
          message: "Login successful",
          token: "jwt-token",
          user: { id: 10, email, userType: "cliente" },
          receivedPassword: password,
        }),
      },
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "alice@example.com",
      password: "secret",
    });

    expect(authServiceMock.login).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "secret",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 200,
      message: "Login successful",
      token: "jwt-token",
      user: { id: 10, email: "alice@example.com", userType: "cliente" },
      receivedPassword: "secret",
    });
  });

  test("GET /api/auth/me rejeita requisição sem token no middleware", async () => {
    const { app } = await loadApp();

    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "No token provided" });
  });

  test("GET /api/auth/me valida bearer token, carrega usuário e retorna sucesso", async () => {
    const { app, jwtMock, userRepositoryMock } = await loadApp({
      jwtOverrides: {
        verify: (token) => ({ id: 77, token }),
      },
      userRepositoryOverrides: {
        getById: async (id) => ({
          id,
          name: "Alice",
          email: "alice@example.com",
          userType: "cliente",
        }),
      },
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer valid-token");

    expect(jwtMock.verify).toHaveBeenCalledWith("valid-token");
    expect(userRepositoryMock.getById).toHaveBeenCalledWith(77);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 200,
      message: "Valid token",
      user: {
        id: 77,
        name: "Alice",
        email: "alice@example.com",
        userType: "cliente",
      },
    });
  });

  test("POST /api/auth/reset-password/validate replica o status do service", async () => {
    const { app, authServiceMock } = await loadApp({
      authServiceOverrides: {
        validateResetToken: async ({ token }) => ({
          status: 400,
          message: `Invalid token: ${token}`,
        }),
      },
    });

    const response = await request(app)
      .post("/api/auth/reset-password/validate")
      .send({ token: "expired-token" });

    expect(authServiceMock.validateResetToken).toHaveBeenCalledWith({
      token: "expired-token",
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      message: "Invalid token: expired-token",
    });
  });
});
