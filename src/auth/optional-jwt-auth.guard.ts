import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<T>(_authError: unknown, user: T): T {
    return user;
  }
}
