import { IsString } from "class-validator";

export class RefreshDto {
  @IsString({ message: "Refresh token must be a string" })
  refreshToken!: string;
}
