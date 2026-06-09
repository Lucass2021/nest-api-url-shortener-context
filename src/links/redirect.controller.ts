import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LinksService } from "./links.service";
import type { FastifyReply } from "fastify";
import { buildPasscodePage } from "./passcode-page";

@ApiTags("Redirect")
@Controller("")
export class RedirectController {
  constructor(private readonly linksService: LinksService) {}

  @Get(":code")
  async redirect(@Param("code") code: string, @Res() res: FastifyReply) {
    const link = await this.linksService.findByCode(code);

    if (link.passcodeHash) {
      return res
        .header("Content-Type", "text/html; charset=utf-8")
        .code(HttpStatus.OK)
        .send(buildPasscodePage(code));
    }

    void this.linksService.incrementClicks(code);
    return res.redirect(link.originalUrl, HttpStatus.FOUND);
  }

  @Get(":code/stats")
  stats(@Param("code") code: string) {
    return this.linksService.stats(code);
  }
}
