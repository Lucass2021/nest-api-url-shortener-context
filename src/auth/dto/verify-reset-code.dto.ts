import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNumberString, Length } from "class-validator";

export class VerifyResetCodeDto {
  @ApiProperty({ example: "teste@hotmail.com" })
  @IsEmail({}, { message: "Invalid email address" })
  email!: string;

  @ApiProperty({ example: "123456" })
  @IsNumberString({}, { message: "Code must be a numeric string" })
  @Length(6, 6, { message: "Code must be exactly 6 digits" })
  code!: string;
}
