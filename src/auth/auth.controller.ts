import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("verify-reset-code")
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
