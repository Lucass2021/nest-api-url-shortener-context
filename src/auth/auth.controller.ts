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
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import {
  CurrentUser,
  type AuthUser,
} from "./decorators/current-user.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: AuthCredentialsDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: AuthCredentialsDto) {
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
}
