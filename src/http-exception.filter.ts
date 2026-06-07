import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (!(exception instanceof HttpException)) {
      void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      });
      return;
    }

    const status = exception.getStatus();
    const response = exception.getResponse();
    const message =
      typeof response === "string"
        ? response
        : ((response as Record<string, unknown>).message ?? exception.message);

    void reply.status(status).send({ statusCode: status, message });
  }
}
