import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { RefreshDto } from "./dto/refresh.dto";
import { PrismaService } from "src/prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { LoginCredentialsDto } from "./dto/login-credentials.dto";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { VerifyResetCodeDto } from "./dto/verify-reset-code.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { Redis } from "ioredis";
import { REDIS_CLIENT } from "src/redis/redis.module";
import { randomBytes, randomInt } from "crypto";
import { MailService } from "src/mail/mail.service";

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
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly mail: MailService,
  ) {}

  async register(user: AuthCredentialsDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existingUser) {
      throw new BadRequestException("User already exists");
    }

    const passwordHash: string = await bcrypt.hash(user.password, 10);
    const createdUser = await this.prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash: passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const tokens = await this.generateTokens(createdUser.id, createdUser.email);

    await this.prisma.user.update({
      where: { id: createdUser.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return { tokens, user: createdUser };
  }

  async login(user: LoginCredentialsDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existingUser) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid: boolean = await bcrypt.compare(
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

      const isRefreshTokenValid: boolean = await bcrypt.compare(
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

  async forgotPassword(dto: ForgotPasswordDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const resetCode = randomInt(100000, 999999).toString();
      const resetCodeHash = await bcrypt.hash(resetCode, 10);

      await this.redis.set(
        `password_reset:${dto.email}`,
        resetCodeHash,
        "EX",
        900, // TTL: 15 min in seconds
      );

      await this.mail.sendResetCode(dto.email, resetCode);
    }

    return {
      message:
        "If an account with that email exists, a reset code has been sent.",
    };
  }

  async verifyResetCode(user: VerifyResetCodeDto) {
    const resetCodeHash = await this.redis.get(`password_reset:${user.email}`);

    if (!resetCodeHash) {
      throw new BadRequestException("Invalid or expired reset code");
    }

    const isCodeValid = await bcrypt.compare(user.code, resetCodeHash);

    if (!isCodeValid) {
      throw new BadRequestException("Invalid or expired reset code");
    }

    const resetToken = randomBytes(32).toString("hex");

    await this.redis.del(`password_reset:${user.email}`);

    await this.redis.set(
      `password_reset_token:${resetToken}`,
      user.email,
      "EX",
      900, // TTL: 15 min in seconds
    );

    return { resetToken };
  }

  async resetPassword(user: ResetPasswordDto) {
    const passwordResetToken = await this.redis.get(
      `password_reset_token:${user.resetToken}`,
    );

    if (!passwordResetToken) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: passwordResetToken },
    });

    if (!existingUser) {
      throw new BadRequestException("Invalid reset token");
    }

    const newPasswordHash = await bcrypt.hash(user.newPassword, 10);

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash: newPasswordHash, refreshTokenHash: null },
    });

    await this.redis.del(`password_reset_token:${user.resetToken}`);

    return { message: "Password has been reset successfully" };
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
