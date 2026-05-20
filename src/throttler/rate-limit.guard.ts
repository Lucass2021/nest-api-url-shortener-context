import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Request, Response } from "express";
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
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const res = context.switchToHttp().getResponse<Response>();

    const user = req.user;
    const key = user ? `rl:user:${user.id}` : `rl:ip:${req.ip}`;
    const limit = user ? AUTH_LIMIT : ANON_LIMIT;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, HOUR_IN_SECONDS);
    }

    if (count > limit) {
      const remainingTtl = await this.redis.ttl(key);
      res.setHeader("Retry-After", remainingTtl);
      throw new HttpException(
        "Too Many Requests",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
