import { Module } from "@nestjs/common";
import { MailerModule } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";
import { MailService } from "./mail.service";

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.getOrThrow<string>("MAIL_HOST"),
          port: parseInt(config.getOrThrow<string>("MAIL_PORT")),
          auth: {
            user: config.getOrThrow<string>("MAIL_USER"),
            pass: config.getOrThrow<string>("MAIL_PASS"),
          },
        },
        defaults: {
          from: `"URL Shortener" <${config.getOrThrow<string>("MAIL_FROM")}>`,
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
