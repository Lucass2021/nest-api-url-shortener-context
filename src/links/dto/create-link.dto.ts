import { IsDateString, IsOptional, IsUrl } from "class-validator";

export class CreateLinkDto {
  @IsUrl({}, { message: "Invalid URL" })
  url!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
