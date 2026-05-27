import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RefreshDto {
  @ApiProperty({ example: "refresh_token_example" })
  @IsString({ message: "Refresh token must be a string" })
  refreshToken!: string;
}
