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
- Use `OptionalJwtAuthGuard` for endpoints where auth is optional (e.g. `POST /links/shorten`).
- Apply `RateLimitGuard` together with `OptionalJwtAuthGuard` on public creation endpoints.
- Never access `req.user` directly in controllers — use the `@CurrentUser()` decorator.

---

## Redis

- Access Redis via the `REDIS_CLIENT` injection token — never instantiate `ioredis` directly.
- Cache keys use prefixed patterns: `rl:ip:<ip>`, `rl:user:<id>` for rate limiting; bare `<code>` for links.
- Always set a TTL when writing to cache (`EX` option).
- Invalidate the cache key when the underlying data is deleted.

---

## Error Handling

- Use NestJS built-in exceptions (`NotFoundException`, `GoneException`, `ForbiddenException`, etc.).
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
- HTTP response variables: describe the action — `loginResponse`, `shortenResponse`, `deleteResponse`, `rateLimitedResponse`.
- When a test has two responses for the same action (e.g. before and after), qualify both — `redirectResponse` and `afterDeleteRedirectResponse`.
- Prefer `await` over `.then()` chains — assign the response to a named variable first, then call `.json()` on the next line.
- Promise utility callbacks use `resolve`/`reject`, not `r`: `new Promise((resolve) => setTimeout(resolve, 100))`.

---

## Tests

- Tests are e2e only — located in `test/`, one file per domain.
- Shared app setup lives in `test/setup.ts` — do not duplicate it.
- Use `ctx.server.inject()` for all HTTP calls — never start a real server in tests.
- Clean the database and Redis in `beforeEach`, not `afterEach`.
- After `npm install`, run `bun run db:generate` before running tests.
