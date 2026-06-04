import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class AuthCredentialsDto {
  @ApiProperty({ example: "John Doe" })
  @IsString({ message: "Name must be a string" })
  name!: string;

  @ApiProperty({ example: "test@hotmail.com" })
  @IsEmail({}, { message: "Invalid email address" })
  email!: string;

  @ApiProperty({ example: "password123" })
  @IsString({ message: "Password must be a string" })
  @MinLength(6, { message: "Password must be at least 6 characters" })
  password!: string;
}
