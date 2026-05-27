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

  it("POST /links/shorten - returns 429 after 10 requests from same IP", async () => {
    for (let i = 0; i < 10; i++) {
      await testApp.server.inject({
        method: "POST",
        url: "/links/shorten",
        payload: { url: "https://www.google.com" },
      });
    }

    const rateLimitedResponse = await testApp.server.inject({
      method: "POST",
      url: "/links/shorten",
      payload: { url: "https://www.google.com" },
    });
    expect(rateLimitedResponse.statusCode).toBe(429);
    expect(rateLimitedResponse.headers["retry-after"]).toBeDefined();
  });
});
