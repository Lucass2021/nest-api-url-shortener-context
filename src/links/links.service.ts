import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 6;

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async shortenUrl(url: string) {
    const code = await this.generateUniqueCode();

    const link = await this.prisma.link.create({
      data: { code, originalUrl: url },
    });

    const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

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
}
