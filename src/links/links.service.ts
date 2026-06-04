import {
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "src/redis/redis.module";
import type { Redis } from "ioredis";
import { ConfigService } from "@nestjs/config";

const SHORT_CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 6;
const CACHE_TTL_SECONDS = 60 * 60;

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async shortenUrl(url: string, userId: string, expiresAt?: string) {
    const code = await this.generateUniqueCode();

    const link = await this.prisma.link.create({
      data: {
        code,
        originalUrl: url,
        userId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });

    const baseUrl = this.config.getOrThrow<string>("BASE_URL");

    return { shortUrl: `${baseUrl}/${link.code}` };
  }

  async findByCode(code: string) {
    const cachedOriginalUrl = await this.redis.get(code);

    if (cachedOriginalUrl) {
      return { originalUrl: cachedOriginalUrl };
    }

    const link = await this.prisma.link.findUnique({ where: { code } });

    if (!link) throw new NotFoundException("Link not found");
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException("Link has expired");
    }

    await this.redis.set(code, link.originalUrl, "EX", CACHE_TTL_SECONDS);

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

    return { message: "Link deleted successfully" };
  }

  private async generateUniqueCode(): Promise<string> {
    let code: string;

    do {
      code = Array.from(
        { length: CODE_LENGTH },
        () =>
          SHORT_CODE_ALPHABET[
            Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)
          ],
      ).join("");
    } while (await this.prisma.link.findUnique({ where: { code } }));

    return code;
  }
}
