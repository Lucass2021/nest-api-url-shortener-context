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
    testApp.sendResetCode.mockClear();
  });

  async function registerUser(
    email = "user@test.com",
    password = "password123",
  ) {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Test User", email, password },
    });
  }

  it("POST /auth/register - creates a user", async () => {
    const registerResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Test User",
        email: "user@test.com",
        password: "password123",
      },
    });
    expect(registerResponse.statusCode).toBe(201);
    expect(
      registerResponse.json<{ user: { email: string } }>().user.email,
    ).toBe("user@test.com");
  });

  it("POST /auth/register - duplicate email returns 400", async () => {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Test User",
        email: "user@test.com",
        password: "password123",
      },
    });
    const duplicateRegisterResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Test User",
        email: "user@test.com",
        password: "password123",
      },
    });
    expect(duplicateRegisterResponse.statusCode).toBe(400);
  });

  it("POST /auth/login - returns access and refresh tokens", async () => {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Test User",
        email: "user@test.com",
        password: "password123",
      },
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
      payload: {
        name: "Test User",
        email: "user@test.com",
        password: "password123",
      },
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
      payload: {
        name: "Test User",
        email: "user@test.com",
        password: "password123",
      },
    });
    const loginResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@test.com", password: "wrongpassword" },
    });
    expect(loginResponse.statusCode).toBe(401);
  });

  it("POST /auth/forgot-password - returns generic message for existing email", async () => {
    await registerUser();
    const forgotPasswordResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "user@test.com" },
    });
    expect(forgotPasswordResponse.statusCode).toBe(201);
    expect(forgotPasswordResponse.json<{ message: string }>().message).toBe(
      "If an account with that email exists, a reset code has been sent.",
    );
    expect(testApp.sendResetCode).toHaveBeenCalledTimes(1);
  });

  it("POST /auth/forgot-password - returns generic message for non-existent email", async () => {
    const forgotPasswordResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "ghost@test.com" },
    });
    expect(forgotPasswordResponse.statusCode).toBe(201);
    expect(forgotPasswordResponse.json<{ message: string }>().message).toBe(
      "If an account with that email exists, a reset code has been sent.",
    );
    expect(testApp.sendResetCode).not.toHaveBeenCalled();
  });

  it("POST /auth/forgot-password - returns 429 on second request within cooldown", async () => {
    await registerUser();
    await testApp.server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "user@test.com" },
    });

    const secondForgotPasswordResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "user@test.com" },
    });
    expect(secondForgotPasswordResponse.statusCode).toBe(429);
  });

  it("POST /auth/verify-reset-code - returns resetToken for valid code", async () => {
    await registerUser();
    await testApp.server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "user@test.com" },
    });
    const [, capturedResetCode] = testApp.sendResetCode.mock.calls[0] as [
      string,
      string,
    ];

    const verifyResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/verify-reset-code",
      payload: { email: "user@test.com", code: capturedResetCode },
    });
    expect(verifyResponse.statusCode).toBe(201);
    expect(
      verifyResponse.json<{ resetToken: string }>().resetToken,
    ).toBeDefined();
  });

  it("POST /auth/verify-reset-code - returns 400 for invalid code", async () => {
    await registerUser();
    await testApp.server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "user@test.com" },
    });

    const verifyResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/verify-reset-code",
      payload: { email: "user@test.com", code: "000000" },
    });
    expect(verifyResponse.statusCode).toBe(400);
  });

  it("POST /auth/verify-reset-code - invalidates code after 5 wrong attempts", async () => {
    await registerUser();
    await testApp.server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "user@test.com" },
    });
    const [, capturedResetCode] = testApp.sendResetCode.mock.calls[0] as [
      string,
      string,
    ];

    for (let i = 0; i < 5; i++) {
      await testApp.server.inject({
        method: "POST",
        url: "/auth/verify-reset-code",
        payload: { email: "user@test.com", code: "000000" },
      });
    }

    const verifyWithCorrectCodeResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/verify-reset-code",
      payload: { email: "user@test.com", code: capturedResetCode },
    });
    expect(verifyWithCorrectCodeResponse.statusCode).toBe(400);
  });

  it("POST /auth/reset-password - returns 400 for invalid token", async () => {
    const resetPasswordResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { resetToken: "invalidtoken", newPassword: "newpassword123" },
    });
    expect(resetPasswordResponse.statusCode).toBe(400);
  });

  it("POST /auth/reset-password - full flow resets password and allows login with new password", async () => {
    await registerUser("user@test.com", "oldpassword123");

    await testApp.server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "user@test.com" },
    });
    const [, capturedResetCode] = testApp.sendResetCode.mock.calls[0] as [
      string,
      string,
    ];

    const verifyResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/verify-reset-code",
      payload: { email: "user@test.com", code: capturedResetCode },
    });
    const { resetToken } = verifyResponse.json<{ resetToken: string }>();

    const resetPasswordResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { resetToken, newPassword: "newpassword123" },
    });
    expect(resetPasswordResponse.statusCode).toBe(201);

    const loginWithOldPasswordResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@test.com", password: "oldpassword123" },
    });
    expect(loginWithOldPasswordResponse.statusCode).toBe(401);

    const loginWithNewPasswordResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@test.com", password: "newpassword123" },
    });
    expect(loginWithNewPasswordResponse.statusCode).toBe(201);
  });
});
