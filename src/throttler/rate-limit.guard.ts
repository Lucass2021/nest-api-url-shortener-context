import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import Redis from "ioredis";
import { REDIS_CLIENT } from "src/redis/redis.module";
import type { AuthUser } from "src/auth/decorators/current-user.decorator";

const HOUR_IN_SECONDS = 3600;
const ANON_LIMIT = 10;
const AUTH_LIMIT = 100;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthUser }>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const user = request.user;
    const rateLimitKey = user ? `rl:user:${user.id}` : `rl:ip:${request.ip}`;
    const limit = user ? AUTH_LIMIT : ANON_LIMIT;

    const requestCount = await this.redis.incr(rateLimitKey);
    if (requestCount === 1) {
      await this.redis.expire(rateLimitKey, HOUR_IN_SECONDS);
    }

    if (requestCount > limit) {
      const retryAfterSeconds = await this.redis.ttl(rateLimitKey);
      response.header("Retry-After", retryAfterSeconds);
      throw new HttpException(
        "Too Many Requests",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
