import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import { loadApp } from "../../test-support/loadApp.helper.js";

describe("Integração de empresas", () => {
  test("GET /api/companies/:companyId/public-dashboard expõe o dashboard público sem autenticação", async () => {
    const { app, companyServiceMock } = await loadApp({
      companyServiceOverrides: {
        getPublicCompanyDashboard: async (companyId) => ({
          status: 200,
          company: { id: Number(companyId), name: "Resolve Mais" },
          summary: { totalTickets: 12 },
        }),
      },
    });

    const response = await request(app).get("/api/companies/7/public-dashboard");

    expect(companyServiceMock.getPublicCompanyDashboard).toHaveBeenCalledWith("7");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 200,
      company: { id: 7, name: "Resolve Mais" },
      summary: { totalTickets: 12 },
    });
  });

  test("GET /api/companies/my-company/admins usa o usuário autenticado vindo do middleware", async () => {
    const { app, companyServiceMock } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 55 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 55,
          name: "Admin",
          userType: "empresa",
        }),
      },
      companyServiceOverrides: {
        getMyCompanyAdmins: async (userId) => ({
          status: 200,
          company: { id: 9, name: "Resolve Mais" },
          admins: [{ id: userId, name: "Admin" }],
        }),
      },
    });

    const response = await request(app)
      .get("/api/companies/my-company/admins")
      .set("Authorization", "Bearer company-token");

    expect(companyServiceMock.getMyCompanyAdmins).toHaveBeenCalledWith(55);
    expect(response.status).toBe(200);
    expect(response.body.admins).toEqual([{ id: 55, name: "Admin" }]);
  });

  test("erro inesperado no controller de company retorna 500 padronizado", async () => {
    const { app } = await loadApp({
      jwtOverrides: {
        verify: () => ({ id: 55 }),
      },
      userRepositoryOverrides: {
        getById: async () => ({
          id: 55,
          name: "Admin",
          userType: "empresa",
        }),
      },
      companyServiceOverrides: {
        updateMyCompanyProfile: async () => {
          throw new Error("unexpected");
        },
      },
    });

    const response = await request(app)
      .patch("/api/companies/my-company/profile")
      .set("Authorization", "Bearer company-token")
      .send({ name: "Nova empresa" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 500,
      message: "Internal server error",
    });
  });
});
