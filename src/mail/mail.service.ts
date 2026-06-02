import { Injectable } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";

@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  async sendResetCode(email: string, code: string) {
    await this.mailer.sendMail({
      to: email,
      subject: "Password reset code",
      html: `
        <p>Your password reset code is:</p>
        <h2>${code}</h2>
        <p>This code expires in 15 minutes.</p>
      `,
    });
  }
}
