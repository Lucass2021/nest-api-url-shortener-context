import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RefreshDto } from "./dto/refresh.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import {
  CurrentUser,
  type AuthUser,
} from "./decorators/current-user.decorator";
import { LoginCredentialsDto } from "./dto/login-credentials.dto";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { VerifyResetCodeDto } from "./dto/verify-reset-code.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: AuthCredentialsDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginCredentialsDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post("logout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.id);
  }

  @Post("forgot-password")
  @ApiResponse({
    status: 201,
    description: "Reset code sent if account exists",
  })
  @ApiResponse({
    status: 429,
    description: "Cooldown active — wait before requesting another code",
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("verify-reset-code")
  @ApiResponse({ status: 201, description: "Code valid — returns resetToken" })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired code, or too many failed attempts",
  })
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post("reset-password")
  @ApiResponse({ status: 201, description: "Password reset successfully" })
  @ApiResponse({ status: 400, description: "Invalid or expired reset token" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: "Returns the authenticated user's name and email",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid token" })
  me(@CurrentUser() user: AuthUser) {
    return { name: user.name, email: user.email };
  }
}
