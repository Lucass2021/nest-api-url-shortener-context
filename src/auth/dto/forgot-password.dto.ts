import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "test@hotmail.com" })
  @IsEmail({}, { message: "Invalid email address" })
  email!: string;
}
