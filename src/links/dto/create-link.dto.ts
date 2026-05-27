import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsUrl } from "class-validator";

export class CreateLinkDto {
  @ApiProperty({ example: "https://www.youtube.com" })
  @IsUrl({}, { message: "Invalid URL" })
  url!: string;

  @ApiPropertyOptional({ example: "2026-12-31T23:59:59.000Z" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
