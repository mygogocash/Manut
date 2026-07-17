import { HttpException } from "@/common/exceptions/http-exception";

export class PreconditionRequiredException extends HttpException {
  constructor(
    message = "Google account not connected",
    code = "GOOGLE_NOT_CONNECTED",
  ) {
    super(412, code, message);
  }
}
