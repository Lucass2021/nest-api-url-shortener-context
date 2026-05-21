import { Controller, Get, Param, Res } from "@nestjs/common";
import { LinksService } from "./links.service";
import type { Response } from "express";

@Controller("")
export class RedirectController {
  constructor(private readonly linksService: LinksService) {}

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
}
