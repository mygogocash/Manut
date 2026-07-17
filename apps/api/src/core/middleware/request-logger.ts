import type { NextFunction, Request, Response } from "express";

import { logger } from "@/common/utils/logger";
import { redactSensitiveRequestPath } from "@/core/middleware/request-path";

export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  logger.info(`${req.method} ${redactSensitiveRequestPath(req.path)}`);
  next();
}
