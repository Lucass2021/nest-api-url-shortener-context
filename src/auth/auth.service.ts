import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { PrismaService } from "src/prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

type JwtPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(user: AuthCredentialsDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existingUser) {
      throw new BadRequestException("User already exists");
    }

    const passwordHash = await bcrypt.hash(user.password, 10);
    const createdUser = await this.prisma.user.create({
      data: {
        email: user.email,
        passwordHash: passwordHash,
      },
    });

    return {
      id: createdUser.id,
      email: createdUser.email,
      createdAt: createdUser.createdAt,
      updatedAt: createdUser.updatedAt,
    };
  }

  async login(user: AuthCredentialsDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existingUser) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      user.password,
      existingUser.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.generateTokens(
      existingUser.id,
      existingUser.email,
    );

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return tokens;
  }

  async refresh(token: RefreshDto) {
    try {
      const refreshTokenPayload = await this.jwt.verifyAsync<JwtPayload>(
        token.refreshToken,
        {
          secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        },
      );

      const existingUser = await this.prisma.user.findUnique({
        where: { id: refreshTokenPayload.sub },
      });

      if (!existingUser?.refreshTokenHash) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const isRefreshTokenValid = await bcrypt.compare(
        token.refreshToken,
        existingUser.refreshTokenHash,
      );

      if (!isRefreshTokenValid) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const tokens = await this.generateTokens(
        existingUser.id,
        existingUser.email,
      );

      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
        },
      });

      return tokens;
    } catch (error) {
      if ((error as { name?: string }).name === "TokenExpiredError") {
        const expiredTokenPayload = this.jwt.decode<JwtPayload>(
          token.refreshToken,
        );
        if (expiredTokenPayload?.sub) {
          await this.prisma.user.updateMany({
            where: { id: expiredTokenPayload.sub },
            data: { refreshTokenHash: null },
          });
        }
      }
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>("JWT_SECRET"),
      expiresIn:
        this.config.getOrThrow<JwtSignOptions["expiresIn"]>("JWT_EXPIRES_IN"),
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.config.getOrThrow<JwtSignOptions["expiresIn"]>(
        "JWT_REFRESH_EXPIRES_IN",
      ),
    });

    return { accessToken, refreshToken };
  }
}
