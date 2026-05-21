import {
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

  async shortenUrl(url: string, userId?: string, expiresAt?: string) {
    const code = await this.generateUniqueCode();

    const link = await this.prisma.link.create({
      data: {
        code,
        originalUrl: url,
        userId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });

    const baseUrl = process.env.BASE_URL;

    if (!baseUrl) {
      throw new Error("BASE_URL environment variable is not defined");
    }

    return { shortUrl: `${baseUrl}/${link.code}` };
  }

  async findByCode(code: string) {
    const cached = await this.redis.get(code);

    if (cached) {
      return { originalUrl: cached };
    }

    const link = await this.prisma.link.findUnique({ where: { code } });

    if (!link) throw new NotFoundException("Link not found");
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException("Link has expired");
    }

    await this.redis.set(code, link.originalUrl, "EX", CACHE_DURATION);

    return link;
  }

  async incrementClicks(code: string) {
    await this.prisma.link.update({
      where: { code },
      data: {
        clicks: { increment: 1 },
        lastVisitAt: new Date(),
      },
    });
  }

  async stats(code: string) {
    const link = await this.prisma.link.findUnique({ where: { code } });

    if (!link) throw new NotFoundException("Link not found");

    return {
      clicks: link.clicks,
      createdAt: link.createdAt,
      lastVisitAt: link.lastVisitAt,
    };
  }

  async findByUser(userId: string) {
    return this.prisma.link.findMany({
      where: { userId },
      select: {
        code: true,
        originalUrl: true,
        clicks: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteByCode(code: string, userId: string) {
    const link = await this.prisma.link.findUnique({ where: { code } });

    if (!link) throw new NotFoundException("Link not found");
    if (link.userId !== userId)
      throw new ForbiddenException("You do not own this link");

    await this.prisma.link.delete({ where: { code } });
    await this.redis.del(code);
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
}
