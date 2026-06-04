import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { REDIS_CLIENT } from "../src/redis/redis.module";
import { MailService } from "../src/mail/mail.service";

export interface TestApp {
  app: NestFastifyApplication;
  prisma: PrismaService;
  redis: Redis;
  server: FastifyInstance;
  sendResetCode: jest.Mock;
}

export async function createTestApp(): Promise<TestApp> {
  const sendResetCode = jest.fn().mockResolvedValue(undefined);

  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue({ sendResetCode })
    .compile();

  const app = testingModule.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get<Redis>(REDIS_CLIENT),
    server: app.getHttpAdapter().getInstance(),
    sendResetCode,
  };
}
