import { ApiProperty } from "@nestjs/swagger";
import { Matches } from "class-validator";

export class VerifyPasscodeDto {
  @ApiProperty({ example: "1234" })
  @Matches(/^\d{4}$/, { message: "passcode must be 4 digits" })
  passcode!: string;
}
