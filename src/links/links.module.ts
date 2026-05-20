import { Module } from "@nestjs/common";
import { LinksController } from "./links.controller";
import { LinksService } from "./links.service";
import { AuthModule } from "src/auth/auth.module";
import { RateLimitGuard } from "src/throttler/rate-limit.guard";

@Module({
  imports: [AuthModule],
  controllers: [LinksController],
  providers: [LinksService, RateLimitGuard],
})
export class LinksModule {}
