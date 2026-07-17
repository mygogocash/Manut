export class HttpException extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    this.name = "HttpException";
  }
}

export class BadRequestException extends HttpException {
  constructor(
    message: string,
    details?: Array<{ field?: string; message: string }>,
  ) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class ValidationException extends HttpException {
  constructor(details: Array<{ field?: string; message: string }>) {
    super(422, "VALIDATION_ERROR", "Validation failed", details);
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message = "Internal server error") {
    super(500, "INTERNAL_SERVER_ERROR", message);
  }
}
