# Project: URL Shortener API

## Context

A study project focused on consolidating backend knowledge to grow from mid-level → senior.
The developer has solid experience in frontend/mobile (React Native, Expo, TypeScript) and is expanding
into backend with NestJS, covering patterns used in real production systems.

---

## Project Goal

Build a complete URL shortener API, focused on **code quality, production patterns, and
learning new technologies** (Redis, queues, rate limiting) — not just delivering the basic feature.

---

## Defined Stack

- **Framework:** NestJS with TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Cache:** Redis (via ioredis or @nestjs/cache-manager)
- **Containerization:** Docker + Docker Compose
- **Testing:** Jest + Supertest (unit and e2e)
- **Documentation:** Swagger (already configured via @nestjs/swagger)
- **Deploy:** Railway or Render (optional, final phase)

---

## Expected Features

### Core (required MVP)

- `POST /shorten` — receives a long URL and returns a short URL with a unique code (e.g. `https://short.ly/abc123`)
- `GET /:code` — redirects to the original URL (HTTP 302)
- `GET /:code/stats` — returns link access statistics (total clicks, creation date, last visit)
- URL validation (must be a valid and reachable URL)
- Link expiration (configurable TTL, e.g. 7 days, 30 days, never)

### Authentication (second phase)

- User registration and login with JWT + refresh token
- Links associated with an authenticated user
- List authenticated user's links (`GET /me/links`)
- Delete own link (`DELETE /links/:code`)

### Rate limiting (third phase)

- Link creation limit per IP (e.g. 10 links/hour for unauthenticated users)
- Higher limit for authenticated users (e.g. 100 links/hour)
- Proper response with `Retry-After` header when limit is reached

### Redis Cache (integrated into core)

- On redirect (`GET /:code`), check Redis first before hitting Postgres
- Cache TTL aligned with link expiration
- Cache invalidation when a link is deleted

---

## Business Rules

- Short codes must be unique (6–8 alphanumeric characters)
- Code collisions must be handled with automatic retry
- Invalid or already-expired URLs return appropriate errors (400 / 410 Gone)
- Click count must be incremented asynchronously (must not block the redirect)
- All endpoints must have standardized error handling (global exception filter)

---

## Expected Patterns and Quality

- NestJS module architecture (AuthModule, LinksModule, StatsModule, CacheModule)
- DTOs with validation via class-validator
- Global validation pipes
- JWT authentication guards
- Unit tests on main services
- e2e tests on main endpoints
- README with setup instructions, environment variables, and request examples
- Docker Compose with Postgres + Redis ready to run locally with a single command

---

## What the Developer Wants to Learn

1. **Redis in practice** — read cache, TTL, invalidation
2. **Real rate limiting** — not just NestJS's basic throttle, but with Redis to work across multiple instances
3. **Async click counting** — increment clicks without blocking the response (BullMQ or batch update strategy)
4. **Production patterns** — exception filters, interceptors, global pipes, logging
5. **Real testing** — not just tests that pass, but testing error cases and edge cases

---

## Suggested Steps (milestones)

| #   | Deliverable                                                        | Estimated time |
| --- | ------------------------------------------------------------------ | -------------- |
| 1   | Initial setup: NestJS + Prisma + Postgres + Docker Compose running | a few hours    |
| 2   | `POST /shorten` and `GET /:code` working without auth              | a weekend      |
| 3   | Redis integrated into redirect with cache and TTL                  | + 1 day        |
| 4   | Click statistics (`GET /:code/stats`)                              | + 1 day        |
| 5   | Full JWT authentication with refresh token                         | + 2–3 days     |
| 6   | Rate limiting per IP with Redis                                    | + 1 day        |
| 7   | Unit and e2e tests for main flows                                  | + 2 days       |
| 8   | Documented Swagger + README + deploy                               | + 1 day        |

---

## How to Use This Context with Another AI

Paste this document and add one of the instructions below depending on what you need:

**To start the project:**

> "Based on this context, help me set up the NestJS project from scratch with Docker Compose, Prisma, and the required dependencies."

**For a specific step:**

> "Based on this context, I'm on step 3 (Redis on redirect). Help me implement the cache with correct invalidation."

**For a code review:**

> "Based on this context, review this service/controller and point out what a senior dev would change."

**For tests:**

> "Based on this context, help me write e2e tests for the link creation and redirect flow."
