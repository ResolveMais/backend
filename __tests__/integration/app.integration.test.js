import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import { loadApp } from "../../test-support/loadApp.helper.js";

describe("Integração do app", () => {
  test("GET / retorna Hello World e executa a inicialização do banco no pipeline", async () => {
    const { app, initializeDatabase } = await loadApp();

    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello World!");
    expect(initializeDatabase).toHaveBeenCalledTimes(1);
  });

  test("falha de inicialização do banco interrompe a requisição com status 500", async () => {
    const { app, initializeDatabase } = await loadApp({
      initializeDatabaseImplementation: async () => {
        throw new Error("db offline");
      },
    });

    const response = await request(app).get("/");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Database initialization failed.",
    });
    expect(initializeDatabase).toHaveBeenCalledTimes(1);
  });
});
