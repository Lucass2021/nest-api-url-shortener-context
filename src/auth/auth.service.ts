import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { PrismaService } from "src/prisma/prisma.service";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(user: AuthCredentialsDto) {
    console.log(user);

    const userInDatabase = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (userInDatabase) {
      throw new BadRequestException("User already exists");
    }

    const passwordHash = await bcrypt.hash(user.password, 10);
    const newUser = await this.prisma.user.create({
      data: {
        email: user.email,
        passwordHash: passwordHash,
      },
    });

    return {
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
  }

  login(user: AuthCredentialsDto) {
    console.log(user);
  }

  refresh(token: RefreshDto) {
    console.log(token);
  }
}
