import { createTestApp, type TestApp } from "./setup";

describe("Links (e2e)", () => {
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

  async function loginAs(
    email = "test@test.com",
    password = "password123",
  ): Promise<{ accessToken: string; refreshToken: string }> {
    await testApp.server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Test User", email, password },
    });
    const loginResponse = await testApp.server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
    });
    return loginResponse.json();
  }

  async function shortenUrl(
    url: string,
    accessToken?: string,
  ): Promise<string> {
    const shortenResponse = await testApp.server.inject({
      method: "POST",
      url: "/links/shorten",
      payload: { url },
      headers: accessToken
        ? { authorization: `Bearer ${accessToken}` }
        : undefined,
    });
    return shortenResponse
      .json<{ shortUrl: string }>()
      .shortUrl.split("/")
      .pop()!;
  }

  it("POST /links/shorten - creates a short link", async () => {
    const shortenResponse = await testApp.server.inject({
      method: "POST",
      url: "/links/shorten",
      payload: { url: "https://www.google.com" },
    });
    expect(shortenResponse.statusCode).toBe(201);
    expect(shortenResponse.json<{ shortUrl: string }>().shortUrl).toMatch(
      /\/.{6}$/,
    );
  });

  it("GET /:code - redirects to original URL (302)", async () => {
    const code = await shortenUrl("https://www.google.com");

    const redirectResponse = await testApp.server.inject({
      method: "GET",
      url: `/${code}`,
    });
    expect(redirectResponse.statusCode).toBe(302);
    expect(redirectResponse.headers.location).toBe("https://www.google.com");
  });

  it("GET /:code - caches URL in Redis after first redirect", async () => {
    const code = await shortenUrl("https://www.google.com");

    await testApp.server.inject({ method: "GET", url: `/${code}` });
    expect(await testApp.redis.get(code)).toBe("https://www.google.com");
  });

  it("GET /:code - expired link returns 410", async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const shortenResponse = await testApp.server.inject({
      method: "POST",
      url: "/links/shorten",
      payload: { url: "https://www.google.com", expiresAt: pastDate },
    });
    const code = shortenResponse
      .json<{ shortUrl: string }>()
      .shortUrl.split("/")
      .pop()!;

    const expiredRedirectResponse = await testApp.server.inject({
      method: "GET",
      url: `/${code}`,
    });
    expect(expiredRedirectResponse.statusCode).toBe(410);
  });

  it("GET /:code/stats - returns click count after redirect", async () => {
    const code = await shortenUrl("https://www.google.com");

    await testApp.server.inject({ method: "GET", url: `/${code}` });
    await new Promise(resolve => setTimeout(resolve, 100));

    const statsResponse = await testApp.server.inject({
      method: "GET",
      url: `/${code}/stats`,
    });
    expect(statsResponse.statusCode).toBe(200);
    expect(statsResponse.json<{ clicks: number }>().clicks).toBe(1);
  });

  it("GET /links/me/links - returns 401 without token", async () => {
    const unauthResponse = await testApp.server.inject({
      method: "GET",
      url: "/links/me/links",
    });
    expect(unauthResponse.statusCode).toBe(401);
  });

  it("GET /links/me/links - returns only the authenticated user's links", async () => {
    const { accessToken } = await loginAs();
    await shortenUrl("https://www.google.com", accessToken);

    const myLinksResponse = await testApp.server.inject({
      method: "GET",
      url: "/links/me/links",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(myLinksResponse.statusCode).toBe(200);
    const links = myLinksResponse.json<Array<{ originalUrl: string }>>();
    expect(links).toHaveLength(1);
    expect(links[0].originalUrl).toBe("https://www.google.com");
  });

  it("DELETE /links/:code - deletes link and clears Redis cache", async () => {
    const { accessToken } = await loginAs();
    const code = await shortenUrl("https://www.google.com", accessToken);

    await testApp.server.inject({ method: "GET", url: `/${code}` });
    expect(await testApp.redis.get(code)).toBe("https://www.google.com");

    const deleteResponse = await testApp.server.inject({
      method: "DELETE",
      url: `/links/${code}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(await testApp.redis.get(code)).toBeNull();

    const afterDeleteRedirectResponse = await testApp.server.inject({
      method: "GET",
      url: `/${code}`,
    });
    expect(afterDeleteRedirectResponse.statusCode).toBe(404);
  });

  it("DELETE /links/:code - returns 403 for another user's link", async () => {
    const { accessToken: token1 } = await loginAs("user1@test.com");
    const { accessToken: token2 } = await loginAs("user2@test.com");
    const code = await shortenUrl("https://www.google.com", token1);

    const forbiddenResponse = await testApp.server.inject({
      method: "DELETE",
      url: `/links/${code}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(forbiddenResponse.statusCode).toBe(403);
  });
});
