import { Body, Controller, Post } from "@nestjs/common";
import { CreateLinkDto } from "./dto/create-link.dto";
import { LinksService } from "./links.service";

@Controller("links")
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post("shorten")
  shortenUrl(@Body() dto: CreateLinkDto) {
    return this.linksService.shortenUrl(dto.url);
  }
}
