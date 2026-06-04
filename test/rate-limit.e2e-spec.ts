import { createTestApp, type TestApp } from "./setup";

describe("Rate Limiting (e2e)", () => {
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

  it("POST /links/shorten - returns 429 after exceeding authenticated rate limit", async () => {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Test User",
        email: "test@test.com",
        password: "password123",
      },
    });
    const loginResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "password123" },
    });
    const { accessToken } = loginResponse.json<{ accessToken: string }>();

    const user = await testApp.prisma.user.findUnique({
      where: { email: "test@test.com" },
    });
    await testApp.redis.set(`rl:user:${user!.id}`, "100", "EX", 3600);

    const rateLimitedResponse = await testApp.server.inject({
      method: "POST",
      url: "/links/shorten",
      payload: { url: "https://www.google.com" },
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(rateLimitedResponse.statusCode).toBe(429);
    expect(rateLimitedResponse.headers["retry-after"]).toBeDefined();
  });
});
