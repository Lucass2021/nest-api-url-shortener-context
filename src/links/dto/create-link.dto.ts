import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsUrl } from "class-validator";

export enum ExpirationOption {
  SEVEN_DAYS = "7d",
  THIRTY_DAYS = "30d",
  NEVER = "never",
}

export class CreateLinkDto {
  @ApiProperty({ example: "https://www.youtube.com" })
  @IsUrl({}, { message: "Invalid URL" })
  url!: string;

  @ApiPropertyOptional({
    enum: ExpirationOption,
    example: ExpirationOption.SEVEN_DAYS,
  })
  @IsOptional()
  @IsEnum(ExpirationOption)
  expiration?: ExpirationOption;
}
