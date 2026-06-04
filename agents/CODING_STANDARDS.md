# Coding Standards — URL Shortener API

When working on this project, follow these rules **strictly**.

---

## Module Structure

```
src/<domain>/
  <domain>.module.ts
  <domain>.controller.ts
  <domain>.service.ts
  dto/
    <action>-<domain>.dto.ts
```

- One module per domain (`auth`, `links`, `health`).
- Controllers handle HTTP only — no business logic.
- All business logic lives in the service.
- DTOs validate all incoming data via `class-validator`.

---

## Guards and Auth

- Use `JwtAuthGuard` for endpoints that require authentication.
- Use `OptionalJwtAuthGuard` for endpoints where auth is optional.
- Apply `RateLimitGuard` together with `JwtAuthGuard` on authenticated creation endpoints (e.g. `POST /links/shorten`).
- Never access `req.user` directly in controllers — use the `@CurrentUser()` decorator.
- Auth-specific rate limiting (e.g. cooldowns between reset code requests) belongs in the **service**, not in a guard — the key is derived from the request body (email), not from HTTP context.

---

## Redis

- Access Redis via the `REDIS_CLIENT` injection token — never instantiate `ioredis` directly.
- Cache keys use prefixed patterns:
  - `rl:user:<id>` — rate limiting per authenticated user
  - `<code>` — cached original URL for redirect
  - `password_reset:<email>` — bcrypt hash of the 6-digit reset code
  - `password_reset:cooldown:<email>` — cooldown flag (60s TTL) after sending a reset code
  - `password_reset:attempts:<email>` — wrong attempt counter during code verification
  - `password_reset_token:<token>` — email associated with a verified reset token
- Always set a TTL when writing to cache (`EX` option).
- Invalidate the cache key when the underlying data is deleted.
- When deleting multiple related keys atomically, pass all keys to a single `redis.del(key1, key2)` call.

---

## Error Handling

- Use NestJS built-in exceptions (`NotFoundException`, `GoneException`, `ForbiddenException`, etc.).
- For `429 Too Many Requests`, use `new HttpException("...", HttpStatus.TOO_MANY_REQUESTS)` — there is no built-in `TooManyRequestsException`.
- Never throw raw `Error` objects from services.
- Do not catch exceptions in services unless you intend to rethrow a different one.

---

## TypeScript

- **No `any`**, no `@ts-ignore` / `@ts-expect-error`.
- Type all DTO properties and service return values explicitly.
- Use `import type` for type-only imports.
- Third-party library calls whose return type resolves as `any` (e.g. `bcrypt.hash`, `bcrypt.compare`) must be annotated explicitly: `const hash: string = await bcrypt.hash(...)`.

---

## Prisma

- Always use `select` when querying the `User` model in service return values — never expose `passwordHash` or `refreshTokenHash` in responses.
- Separate DTOs per operation when field requirements differ (e.g. `AuthCredentialsDto` for register with `name`, `LoginCredentialsDto` for login without it).

---

## Clean Code

- No comments in code (names must be self-explanatory).
- No `console.log` — use NestJS `Logger` if logging is needed.
- All identifiers in **English**.

---

## Naming

- Name variables after what they represent, not their type. **Never** use `res`, `r`, `res1`, `result` as variable names.
- Service method parameters should be named after the domain concept they carry, not the pattern. Use `user` when the data represents a user, `token` when it represents a token — not the generic `dto`. Exception: when the parameter is a generic operation request with no clear domain name (e.g. `verifyResetCode`, `resetPassword`), `dto` is acceptable.
- HTTP response variables: describe the action — `loginResponse`, `shortenResponse`, `deleteResponse`, `rateLimitedResponse`.
- When a test has two responses for the same action (e.g. before and after), qualify both — `redirectResponse` and `afterDeleteRedirectResponse`.
- Prefer `await` over `.then()` chains — assign the response to a named variable first, then call `.json()` on the next line.
- Promise utility callbacks use `resolve`/`reject`, not `r`: `new Promise((resolve) => setTimeout(resolve, 100))`.

---

## Magic Numbers

- Never use bare numeric literals for values that have a name or business meaning. Extract them as named constants at the top of the file.
- The name must explain *what* the number represents, not just *what it is*: `BCRYPT_SALT_ROUNDS = 10`, not `HASH_ROUNDS = 10`; `RESET_CODE_TTL_SECONDS = 900`, not `TTL = 900`.
- Use `HttpStatus.*` for HTTP status codes instead of numeric literals (e.g. `HttpStatus.FOUND` instead of `302`).
- Standard framework defaults (e.g. port `3000` as a fallback, Redis port `6379`) and example values in Swagger decorators are exempt.

---

## Tests

- Tests are e2e only — located in `test/`, one file per domain.
- Shared app setup lives in `test/setup.ts` — do not duplicate it.
- Use `testApp.server.inject()` for all HTTP calls — never start a real server in tests.
- Clean the database and Redis in `beforeEach`, not `afterEach`.
- After `bun install`, run `bun run db:generate` before running tests.
- External services (e.g. `MailService`) must be mocked in `setup.ts` via `.overrideProvider()`. Expose the mock on the `TestApp` interface so tests can assert on calls and capture arguments (e.g. reading the reset code sent via email).
- To test rate limiting without making N real requests, pre-set the Redis counter directly: `testApp.redis.set('rl:user:<id>', '<limit>', 'EX', 3600)`.
