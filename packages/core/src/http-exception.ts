/** Same wire shape as legacy Express + apps/edge errorHandler. */
export type ErrorDetail = { field?: string; message: string; messageTh?: string };

export class HttpException extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "HttpException";
  }
}
export class BadRequestException extends HttpException {
  constructor(message: string, details?: ErrorDetail[]) {
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
