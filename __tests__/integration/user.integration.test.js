import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import { loadApp } from "../../test-support/loadApp.helper.js";

describe("Integração de usuário", () => {
  test("PATCH /api/users/update-profile exige autenticação", async () => {
    const { app } = await loadApp();

    const response = await request(app)
      .patch("/api/users/update-profile")
      .send({ name: "Sem token" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "No token provided" });
  });

  test("PATCH /api/users/update-profile atualiza perfil e normaliza campos", async () => {
    const { app, userRepositoryMock } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 91 }),
      },
      userRepositoryOverrides: {
        getById: async (id) => ({
          id,
          name: "Nome Atualizado",
          email: "novo@example.com",
          phone: "11999999999",
        }),
        getByEmail: async () => null,
        update: async () => 1,
      },
    });

    const response = await request(app)
      .patch("/api/users/update-profile")
      .set("Authorization", "Bearer user-token")
      .send({
        name: " Nome Atualizado ",
        email: " novo@example.com ",
        phone: " 11999999999 ",
        avatarUrl: " https://example.com/avatar.png ",
      });

    expect(userRepositoryMock.update).toHaveBeenCalledWith(91, {
      name: "Nome Atualizado",
      phone: "11999999999",
      avatarUrl: "https://example.com/avatar.png",
      email: "novo@example.com",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Profile updated successfully",
      user: {
        id: 91,
        name: "Nome Atualizado",
        email: "novo@example.com",
        phone: "11999999999",
      },
    });
  });

  test("PATCH /api/users/update-profile bloqueia e-mail já cadastrado", async () => {
    const { app } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 91 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 91,
          name: "Alice",
        }),
        getByEmail: async () => ({
          id: 100,
          email: "duplicado@example.com",
        }),
      },
    });

    const response = await request(app)
      .patch("/api/users/update-profile")
      .set("Authorization", "Bearer user-token")
      .send({ email: "duplicado@example.com" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "E-mail already registered",
    });
  });
});
