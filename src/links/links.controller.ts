import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { LinksService } from "./links.service";
import type { Response } from "express";
import { CreateLinkDto } from "./dto/create-link.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import {
  CurrentUser,
  type AuthUser,
} from "../auth/decorators/current-user.decorator";
import { RateLimitGuard } from "src/throttler/rate-limit.guard";

@Controller("links")
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get("me/links")
  @UseGuards(JwtAuthGuard)
  myLinks(@CurrentUser() user: AuthUser) {
    return this.linksService.findByUser(user.id);
  }

  @Post("shorten")
  @UseGuards(OptionalJwtAuthGuard, RateLimitGuard)
  shortenUrl(
    @Body() dto: CreateLinkDto,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.linksService.shortenUrl(dto.url, user?.id);
  }

  @Get(":code")
  async redirect(@Param("code") code: string, @Res() res: Response) {
    const link = await this.linksService.findByCode(code);
    res.redirect(302, link.originalUrl);
    void this.linksService.incrementClicks(code);
  }

  @Get(":code/stats")
  stats(@Param("code") code: string) {
    return this.linksService.stats(code);
  }

  @Delete(":code")
  @UseGuards(JwtAuthGuard)
  deleteLink(@Param("code") code: string, @CurrentUser() user: AuthUser) {
    return this.linksService.deleteByCode(code, user.id);
  }
}
