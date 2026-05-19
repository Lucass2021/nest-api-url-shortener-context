import { IsUrl } from "class-validator";

export class CreateLinkDto {
  @IsUrl({}, { message: "Invalid URL" })
  url!: string;
}
