import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

export type AuthUser = { id: string; email: string };

export const CurrentUser = createParamDecorator(
  (
    _decoratorData: unknown,
    executionContext: ExecutionContext,
  ): AuthUser | undefined => {
    const request = executionContext
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthUser }>();
    return request.user;
  },
);
