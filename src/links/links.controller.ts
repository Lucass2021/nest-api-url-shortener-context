import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common";
import { LinksService } from "./links.service";
import type { Response } from "express";
import { CreateLinkDto } from "./dto/create-link.dto";

@Controller("links")
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post("shorten")
  shortenUrl(@Body() dto: CreateLinkDto) {
    return this.linksService.shortenUrl(dto.url);
  }

  @Get(":code")
  async redirect(@Param("code") code: string, @Res() res: Response) {
    const link = await this.linksService.findByCode(code);
    res.redirect(302, link.originalUrl);
  }
}
