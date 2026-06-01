import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LinksService } from "./links.service";
import { CreateLinkDto } from "./dto/create-link.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import {
  CurrentUser,
  type AuthUser,
} from "../auth/decorators/current-user.decorator";
import { RateLimitGuard } from "src/throttler/rate-limit.guard";

@ApiTags("Links")
@Controller("links")
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get("me/links")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  myLinks(@CurrentUser() user: AuthUser) {
    return this.linksService.findByUser(user.id);
  }

  @Post("shorten")
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard, RateLimitGuard)
  shortenUrl(
    @Body() dto: CreateLinkDto,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.linksService.shortenUrl(dto.url, user?.id, dto.expiresAt);
  }

  @Delete(":code")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteLink(@Param("code") code: string, @CurrentUser() user: AuthUser) {
    return this.linksService.deleteByCode(code, user.id);
  }
}
