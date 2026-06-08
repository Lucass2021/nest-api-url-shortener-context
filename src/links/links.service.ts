import {
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "src/redis/redis.module";
import type { Redis } from "ioredis";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { ExpirationOption } from "./dto/create-link.dto";

const BCRYPT_SALT_ROUNDS = 10;
const SHORT_CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 6;
const CACHE_TTL_SECONDS = 60 * 60;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async shortenUrl(
    url: string,
    userId: string,
    expiration?: ExpirationOption,
    passcode?: string,
  ) {
    const code = await this.generateUniqueCode();

    let passcodeHash: string | null = null;
    if (passcode) {
      const hash: string = await bcrypt.hash(passcode, BCRYPT_SALT_ROUNDS);
      passcodeHash = hash;
    }

    const link = await this.prisma.link.create({
      data: {
        code,
        originalUrl: url,
        userId,
        expiresAt: this.resolveExpiration(expiration),
        passcodeHash,
      },
    });

    const baseUrl = this.config.getOrThrow<string>("BASE_URL");

    return { shortUrl: `${baseUrl}/${link.code}` };
  }

  async findByCode(code: string) {
    const cachedOriginalUrl = await this.redis.get(code);

    if (cachedOriginalUrl) {
      const passcodeHash: string | null = null;
      return { originalUrl: cachedOriginalUrl, passcodeHash };
    }

    const link = await this.prisma.link.findUnique({ where: { code } });

    if (!link) throw new NotFoundException("Link not found");
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException("Link has expired");
    }

    if (!link.passcodeHash) {
      await this.redis.set(code, link.originalUrl, "EX", CACHE_TTL_SECONDS);
    }

    return { originalUrl: link.originalUrl, passcodeHash: link.passcodeHash };
  }

  async verifyPasscode(code: string, passcode: string) {
    const link = await this.prisma.link.findUnique({ where: { code } });

    if (!link) throw new NotFoundException("Link not found");
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException("Link has expired");
    }
    if (!link.passcodeHash) {
      return { originalUrl: link.originalUrl };
    }

    const isValid: boolean = await bcrypt.compare(passcode, link.passcodeHash);
    if (!isValid) throw new UnauthorizedException("Wrong passcode");

    return { originalUrl: link.originalUrl };
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
    const links = await this.prisma.link.findMany({
      where: { userId },
      select: {
        code: true,
        originalUrl: true,
        clicks: true,
        createdAt: true,
        expiresAt: true,
        passcodeHash: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return links.map(({ passcodeHash, ...link }) => ({
      ...link,
      isProtected: !!passcodeHash,
    }));
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

  private resolveExpiration(expiration?: ExpirationOption): Date | undefined {
    if (!expiration || expiration === ExpirationOption.NEVER) return undefined;
    const offsetMs =
      expiration === ExpirationOption.SEVEN_DAYS
        ? SEVEN_DAYS_MS
        : THIRTY_DAYS_MS;
    return new Date(Date.now() + offsetMs);
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
