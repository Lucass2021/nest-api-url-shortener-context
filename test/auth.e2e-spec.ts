import { createTestApp, type TestApp } from "./setup";

describe("Auth (e2e)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await testApp.prisma.link.deleteMany();
    await testApp.prisma.user.deleteMany();
    await testApp.redis.flushdb();
  });

  it("POST /auth/register - creates a user", async () => {
    const registerResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "user@test.com", password: "password123" },
    });
    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.json<{ email: string }>().email).toBe(
      "user@test.com",
    );
  });

  it("POST /auth/register - duplicate email returns 400", async () => {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "user@test.com", password: "password123" },
    });
    const duplicateRegisterResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "user@test.com", password: "password123" },
    });
    expect(duplicateRegisterResponse.statusCode).toBe(400);
  });

  it("POST /auth/login - returns access and refresh tokens", async () => {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "user@test.com", password: "password123" },
    });
    const loginResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@test.com", password: "password123" },
    });
    expect(loginResponse.statusCode).toBe(201);
    const { accessToken, refreshToken } = loginResponse.json<{
      accessToken: string;
      refreshToken: string;
    }>();
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();
  });

  it("POST /auth/logout - clears refresh token hash", async () => {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "user@test.com", password: "password123" },
    });
    const loginResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@test.com", password: "password123" },
    });
    const { accessToken } = loginResponse.json<{
      accessToken: string;
      refreshToken: string;
    }>();

    const logoutResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logoutResponse.statusCode).toBe(204);

    const user = await testApp.prisma.user.findUnique({
      where: { email: "user@test.com" },
    });
    expect(user?.refreshTokenHash).toBeNull();
  });

  it("POST /auth/login - wrong password returns 401", async () => {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "user@test.com", password: "password123" },
    });
    const loginResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@test.com", password: "wrongpassword" },
    });
    expect(loginResponse.statusCode).toBe(401);
  });
});
