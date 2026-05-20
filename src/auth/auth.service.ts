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
    const userInDatabase = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (userInDatabase) {
      throw new BadRequestException("User already exists");
    }

    const passwordHash = await bcrypt.hash(user.password, 10);
    const newUser = await this.prisma.user.create({
      data: {
        email: user.email,
        passwordHash: passwordHash,
      },
    });

    return {
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
  }

  async login(user: AuthCredentialsDto) {
    const userInDatabase = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!userInDatabase) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      user.password,
      userInDatabase.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.generateTokens(
      userInDatabase.id,
      userInDatabase.email,
    );

    await this.prisma.user.update({
      where: { id: userInDatabase.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return tokens;
  }

  async refresh(token: RefreshDto) {
    try {
      const userRefreshTokenInDatabase = await this.jwt.verifyAsync<JwtPayload>(
        token.refreshToken,
        {
          secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        },
      );

      const userInDatabase = await this.prisma.user.findUnique({
        where: { id: userRefreshTokenInDatabase.sub },
      });

      if (!userInDatabase?.refreshTokenHash) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const isRefreshTokenValid = await bcrypt.compare(
        token.refreshToken,
        userInDatabase.refreshTokenHash,
      );

      if (!isRefreshTokenValid) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const tokens = await this.generateTokens(
        userInDatabase.id,
        userInDatabase.email,
      );

      await this.prisma.user.update({
        where: { id: userInDatabase.id },
        data: {
          refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
        },
      });

      return tokens;
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
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
