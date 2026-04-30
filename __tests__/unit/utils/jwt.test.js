import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";

describe("app/utils/jwt", () => {
  beforeEach(() => {
    process.env.ACCESS_TOKEN_SECRET = "unit-test-secret";
    process.env.JWT_EXPIRATION = "1h";
    process.env.JWT_ALGORITHM = "HS256";
  });

  afterEach(() => {
    delete process.env.ACCESS_TOKEN_SECRET;
    delete process.env.JWT_EXPIRATION;
    delete process.env.JWT_ALGORITHM;
  });

  test("sign and verify preserve the expected auth payload", async () => {
    const jwtUtils = await import("../../../app/utils/jwt.js");

    const token = jwtUtils.sign({
      id: 7,
      email: "user@example.com",
      userType: "cliente",
      password: "secret",
    });

    const decoded = jwtUtils.verify(`Bearer ${token}`);

    expect(decoded).toEqual(
      expect.objectContaining({
        id: 7,
        email: "user@example.com",
        userType: "cliente",
      })
    );
    expect(decoded).not.toHaveProperty("password");
  });

  test("decode accepts bearer tokens without validating expiration", async () => {
    const jwtUtils = await import("../../../app/utils/jwt.js");

    const token = jwtUtils.sign({
      id: 9,
      email: "decode@example.com",
      userType: "empresa",
    });

    const decoded = jwtUtils.decode(`Bearer ${token}`);

    expect(decoded).toEqual(
      expect.objectContaining({
        id: 9,
        email: "decode@example.com",
        userType: "empresa",
      })
    );
  });

  test("verify throws a domain-specific error for invalid tokens", async () => {
    const jwtUtils = await import("../../../app/utils/jwt.js");

    expect(() => jwtUtils.verify("Bearer invalid-token")).toThrow(
      "Token is invalid or expired"
    );
  });
});
