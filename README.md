# URL Shortener API

A production-focused URL shortener API built as a study project to consolidate backend patterns.
Covers Redis caching, JWT authentication, rate limiting, and e2e testing with NestJS.

---

## Stack

- **Framework:** NestJS v11 + TypeScript
- **HTTP:** Fastify
- **Database:** PostgreSQL 16 + Prisma 6 ORM
- **Cache:** Redis 7 (ioredis)
- **Auth:** JWT + refresh token (passport-jwt)
- **Containers:** Docker + Docker Compose
- **Tests:** Jest + Fastify inject (e2e)
- **Docs:** Swagger at `/docs`

---

## Getting Started

### Prerequisites

- Node.js 22+
- Docker + Docker Compose

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Copy environment variables
cp .env.example .env

# 3. Start Postgres and Redis
bun run docker:up

# 4. Run migrations and generate Prisma client
bun run db:migrate
bun run db:generate

# 5. Start the server
bun run dev
```

The API will be available at `http://localhost:3000`.
Swagger docs at `http://localhost:3000/docs`.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | see `.env.example` |
| `DB_USER` | Postgres user | `postgres` |
| `DB_PASSWORD` | Postgres password | `postgres` |
| `DB_NAME` | Database name | `url_shortener` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | `redis` |
| `BASE_URL` | Base URL used to build short links | `http://localhost:3000` |
| `JWT_SECRET` | Access token signing secret | — |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | — |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |

---

## Scripts

```bash
bun run dev              # Start with hot reload
bun run build            # Compile to dist/
bun run start:prod       # Run compiled build

bun run db:migrate       # Run Prisma migrations (dev)
bun run db:migrate:prod  # Run Prisma migrations (prod)
bun run db:generate      # Generate Prisma client
bun run db:studio        # Open Prisma Studio

bun run docker:up        # Start Postgres + Redis containers
bun run docker:down      # Stop containers

bun run test:e2e         # Run e2e tests (requires Docker running)
bun run lint             # ESLint + Prisma schema validation
```

---

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account |
| `POST` | `/auth/login` | — | Login, returns access + refresh tokens |
| `POST` | `/auth/refresh` | — | Issue new access token via refresh token |

### Links

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/links/shorten` | Optional | Shorten a URL |
| `GET` | `/links/me/links` | Required | List authenticated user's links |
| `DELETE` | `/links/:code` | Required | Delete own link |

### Redirect

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/:code` | — | Redirect to original URL (302) |
| `GET` | `/:code/stats` | — | Link stats: total clicks, created at, last visit |

### Request examples

**Shorten a URL**
```http
POST /links/shorten
Content-Type: application/json

{
  "url": "https://www.example.com",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

**Register / Login**
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

---

## Architecture Notes

- **Redis cache:** `GET /:code` checks Redis before hitting Postgres. Cache is invalidated on `DELETE`.
- **Click counting:** incremented asynchronously (fire-and-forget) — never blocks the redirect response.
- **Rate limiting:** tracked per IP in Redis — 10 req/hour for anonymous, 100 req/hour for authenticated. Returns `Retry-After` header on `429`.
- **Link expiration:** links with `expiresAt` in the past return `410 Gone`.
- **Prisma client:** must be regenerated after `npm install` — run `npm run db:generate`.
