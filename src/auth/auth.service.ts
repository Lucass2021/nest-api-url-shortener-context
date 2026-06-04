import {
  BadRequestException,
  HttpException,
  HttpStatus,
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
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "src/redis/redis.module";
import { randomBytes, randomInt } from "crypto";
import { MailService } from "src/mail/mail.service";

const BCRYPT_SALT_ROUNDS = 10;
const RESET_CODE_TTL_SECONDS = 900;
const FORGOT_PASSWORD_COOLDOWN_SECONDS = 60;
const RESET_TOKEN_BYTES = 32;
const REDIS_FLAG = "1";

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

    const passwordHash: string = await bcrypt.hash(
      user.password,
      BCRYPT_SALT_ROUNDS,
    );
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
        refreshTokenHash: await bcrypt.hash(
          tokens.refreshToken,
          BCRYPT_SALT_ROUNDS,
        ),
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
        refreshTokenHash: await bcrypt.hash(
          tokens.refreshToken,
          BCRYPT_SALT_ROUNDS,
        ),
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
          refreshTokenHash: await bcrypt.hash(
            tokens.refreshToken,
            BCRYPT_SALT_ROUNDS,
          ),
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
    const cooldownKey = `password_reset:cooldown:${dto.email}`;
    const onCooldown = await this.redis.get(cooldownKey);

    if (onCooldown) {
      throw new HttpException(
        "Please wait before requesting another reset code",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const resetCode = randomInt(100000, 999999).toString();
      const resetCodeHash: string = await bcrypt.hash(
        resetCode,
        BCRYPT_SALT_ROUNDS,
      );

      await this.setRedisKeyWithExpiry(
        `password_reset:${dto.email}`,
        resetCodeHash,
        RESET_CODE_TTL_SECONDS,
      );

      await this.mail.sendResetCode(dto.email, resetCode);

      await this.setRedisKeyWithExpiry(
        cooldownKey,
        REDIS_FLAG,
        FORGOT_PASSWORD_COOLDOWN_SECONDS,
      );
    }

    return {
      message:
        "If an account with that email exists, a reset code has been sent.",
    };
  }

  async verifyResetCode(dto: VerifyResetCodeDto) {
    const resetCodeKey = `password_reset:${dto.email}`;
    const attemptsKey = `password_reset:attempts:${dto.email}`;

    const resetCodeHash = await this.redis.get(resetCodeKey);

    if (!resetCodeHash) {
      throw new BadRequestException("Invalid or expired reset code");
    }

    const isCodeValid: boolean = await bcrypt.compare(dto.code, resetCodeHash);

    if (!isCodeValid) {
      const attempts = await this.redis.incr(attemptsKey);
      if (attempts === 1) {
        await this.redis.expire(attemptsKey, RESET_CODE_TTL_SECONDS);
      }
      if (attempts >= 5) {
        await this.redis.del(resetCodeKey);
      }
      throw new BadRequestException("Invalid or expired reset code");
    }

    await this.redis.del(resetCodeKey, attemptsKey);

    const resetToken = randomBytes(RESET_TOKEN_BYTES).toString("hex");

    await this.setRedisKeyWithExpiry(
      `password_reset_token:${resetToken}`,
      dto.email,
      RESET_CODE_TTL_SECONDS,
    );

    return { resetToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetTokenEmail = await this.redis.get(
      `password_reset_token:${dto.resetToken}`,
    );

    if (!resetTokenEmail) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: resetTokenEmail },
    });

    if (!existingUser) {
      throw new BadRequestException("Invalid reset token");
    }

    const newPasswordHash: string = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash: newPasswordHash, refreshTokenHash: null },
    });

    await this.redis.del(`password_reset_token:${dto.resetToken}`);

    return { message: "Password has been reset successfully" };
  }

  private setRedisKeyWithExpiry(
    key: string,
    value: string,
    ttlSeconds: number,
  ) {
    return this.redis.set(key, value, "EX", ttlSeconds);
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
