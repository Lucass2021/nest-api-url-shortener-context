import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "src/redis/redis.module";
import Redis from "ioredis";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 6;
const CACHE_DURATION = 60 * 60; // 1 hour

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async shortenUrl(url: string) {
    const code = await this.generateUniqueCode();

    const link = await this.prisma.link.create({
      data: { code, originalUrl: url },
    });

    const baseUrl = process.env.BASE_URL;

    if (!baseUrl) {
      throw new Error("BASE_URL environment variable is not defined");
    }

    return { shortUrl: `${baseUrl}/${link.code}` };
  }

  private async generateUniqueCode(): Promise<string> {
    let code: string;

    do {
      code = Array.from(
        { length: CODE_LENGTH },
        () => CHARS[Math.floor(Math.random() * CHARS.length)],
      ).join("");
    } while (await this.prisma.link.findUnique({ where: { code } }));

    return code;
  }

  async findByCode(code: string) {
    const cached = await this.redis.get(code);

    if (cached) {
      return { originalUrl: cached };
    }

    const link = await this.prisma.link.findUnique({ where: { code } });

    if (!link) throw new NotFoundException("Link not found");
    await this.redis.set(code, link.originalUrl, "EX", CACHE_DURATION);

    return link;
  }
}
