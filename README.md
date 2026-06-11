# URL Shortener API

A production-focused URL shortener API built as a study project to consolidate backend patterns.
Covers Redis caching, JWT authentication, rate limiting, and e2e testing with NestJS.

---

## Stack

- **Framework:** NestJS v11 + TypeScript
- **HTTP:** Fastify
- **Database:** PostgreSQL 16 + Prisma 7 ORM
- **Cache:** Redis 7 (ioredis)
- **Auth:** JWT + refresh token (passport-jwt)
- **Mail:** Nodemailer + Mailtrap (SMTP sandbox)
- **Containers:** Docker + Docker Compose
- **Tests:** Jest + Fastify inject (e2e)
- **Docs:** Swagger at `/docs`

---

## Getting Started

### Prerequisites

- Node.js 22+
- Docker + Docker Compose
- A [Mailtrap](https://mailtrap.io) account (free) for email sandbox

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Copy environment variables
cp .env.example .env

# 3. Fill in secrets in .env (JWT_SECRET, JWT_REFRESH_SECRET, MAIL_* — see below)

# 4. Start Postgres and Redis
bun run docker:up

# 5. Run migrations and generate Prisma client
bun run db:migrate
bun run db:generate

# 6. Start the server
bun run dev
```

The API will be available at `http://localhost:3000`.
Swagger docs at `http://localhost:3000/docs`.

---

## Environment Variables

| Variable                 | Description                        | Default                 |
| ------------------------ | ---------------------------------- | ----------------------- |
| `PORT`                   | HTTP server port                   | `3000`                  |
| `NODE_ENV`               | Environment                        | `development`           |
| `DATABASE_URL`           | PostgreSQL connection string       | see `.env.example`      |
| `DB_USER`                | Postgres user                      | `postgres`              |
| `DB_PASSWORD`            | Postgres password                  | `postgres`              |
| `DB_NAME`                | Database name                      | `url_shortener`         |
| `REDIS_HOST`             | Redis host                         | `localhost`             |
| `REDIS_PORT`             | Redis port                         | `6379`                  |
| `REDIS_PASSWORD`         | Redis password                     | `redis`                 |
| `BASE_URL`               | Base URL used to build short links | `http://localhost:3000` |
| `JWT_SECRET`             | Access token signing secret        | —                       |
| `JWT_EXPIRES_IN`         | Access token TTL                   | `15m`                   |
| `JWT_REFRESH_SECRET`     | Refresh token signing secret       | —                       |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL                  | `7d`                    |
| `MAIL_HOST`              | SMTP host                          | `sandbox.smtp.mailtrap.io` |
| `MAIL_PORT`              | SMTP port                          | `587`                   |
| `MAIL_USER`              | SMTP username                      | —                       |
| `MAIL_PASS`              | SMTP password                      | —                       |
| `MAIL_FROM`              | Sender address                     | `noreply@urlshortener.dev` |

### Mailtrap setup

1. Create a free account at [mailtrap.io](https://mailtrap.io)
2. Open **Email Testing → Inboxes → your inbox → SMTP Settings**
3. Select **Nodemailer** in the integrations dropdown
4. Copy `host`, `port`, `user`, and `pass` into your `.env`

All emails sent in development land in the Mailtrap inbox — nothing reaches real addresses.

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

| Method | Endpoint                    | Auth     | Description                                        |
| ------ | --------------------------- | -------- | -------------------------------------------------- |
| `POST` | `/auth/register`            | —        | Create account, returns tokens + user (auto-login) |
| `POST` | `/auth/login`               | —        | Login, returns access + refresh tokens             |
| `POST` | `/auth/refresh`             | —        | Issue new access token via refresh token           |
| `POST` | `/auth/logout`              | Required | Invalidate refresh token                           |
| `POST` | `/auth/forgot-password`     | —        | Send 6-digit reset code to email (60s cooldown)    |
| `POST` | `/auth/verify-reset-code`   | —        | Validate code, returns one-time `resetToken`       |
| `POST` | `/auth/reset-password`      | —        | Set new password using `resetToken`                |
| `GET`  | `/auth/me`                  | Required | Return authenticated user's name and email         |

### Links

| Method   | Endpoint          | Auth     | Description                     |
| -------- | ----------------- | -------- | ------------------------------- |
| `POST`   | `/links/shorten`  | Required | Shorten a URL                   |
| `GET`    | `/links/me/links` | Required | List authenticated user's links |
| `DELETE` | `/links/:code`    | Required | Delete own link                 |

### Redirect

| Method | Endpoint       | Auth | Description                                      |
| ------ | -------------- | ---- | ------------------------------------------------ |
| `GET`  | `/:code`       | —    | Redirect to original URL (302)                   |
| `GET`  | `/:code/stats` | —    | Link stats: total clicks, created at, last visit |

### Request examples

**Register**

```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123"
}
```

Response `201`:
```json
{
  "tokens": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  },
  "user": {
    "id": "clx...",
    "name": "John Doe",
    "email": "user@example.com",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-01T00:00:00.000Z"
  }
}
```

**Login**

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response `201`:
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

**Forgot password flow**

```http
POST /auth/forgot-password
Content-Type: application/json

{ "email": "user@example.com" }
```

```http
POST /auth/verify-reset-code
Content-Type: application/json

{ "email": "user@example.com", "code": "482910" }
```

Response `201`:
```json
{ "resetToken": "<hex-token>" }
```

```http
POST /auth/reset-password
Content-Type: application/json

{ "resetToken": "<hex-token>", "newPassword": "newpassword123" }
```

**Get current user**

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

Response `200`:
```json
{
  "name": "John Doe",
  "email": "user@example.com"
}
```

**Shorten a URL**

```http
POST /links/shorten
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "url": "https://www.example.com",
  "expiration": "7d"
}
```

`expiration` accepts `"7d"`, `"30d"`, `"never"`, or can be omitted — all result in no expiration except the first two.

Response `201`:
```json
{ "shortUrl": "http://localhost:3000/abc123" }
```

---

## Architecture Notes

- **Redis cache:** `GET /:code` checks Redis before hitting Postgres. Cache is invalidated on `DELETE`.
- **Click counting:** incremented asynchronously (fire-and-forget) — never blocks the redirect response.
- **Rate limiting:** tracked per authenticated user in Redis — 100 req/hour. Returns `Retry-After` header on `429`.
- **Password reset cooldown:** after a reset code is sent, the same email cannot request another for 60 seconds. Code is invalidated after 5 wrong verification attempts.
- **Link expiration:** `POST /links/shorten` accepts `expiration: "7d" | "30d" | "never"` (or omit for no expiration). The backend resolves the enum to an absolute date. Links past their `expiresAt` return `410 Gone`.
- **Prisma client:** must be regenerated after `bun install` — run `bun run db:generate`.
