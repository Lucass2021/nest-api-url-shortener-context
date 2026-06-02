import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ example: "reset_token_example" })
  @IsString()
  @IsNotEmpty({ message: "Reset token is required" })
  resetToken!: string;

  @ApiProperty({ example: "password123" })
  @IsString({ message: "New password must be a string" })
  @MinLength(6, { message: "New password must be at least 6 characters" })
  newPassword!: string;
}
