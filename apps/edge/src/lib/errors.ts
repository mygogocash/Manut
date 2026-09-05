/**
 * Re-export shared HTTP exceptions from @nexora/core so `instanceof` works for
 * both route handlers and domain services.
 */
export {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nexora/core";
export type { ErrorDetail } from "@nexora/core";

import { HttpException } from "@nexora/core";

export class ValidationException extends HttpException {
  constructor(details: import("@nexora/core").ErrorDetail[]) {
    super(422, "VALIDATION_ERROR", "Validation failed", details);
  }
}
export class TooManyRequestsException extends HttpException {
  constructor(message = "Too many requests") {
    super(429, "TOO_MANY_REQUESTS", message);
  }
}
export class InternalServerErrorException extends HttpException {
  constructor(message = "Internal server error") {
    super(500, "INTERNAL_SERVER_ERROR", message);
  }
}
