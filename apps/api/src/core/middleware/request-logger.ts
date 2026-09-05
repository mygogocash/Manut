import type { NextFunction, Request, Response } from "express";

import { logger } from "@/common/utils/logger";

export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  logger.info(`${req.method} ${req.path}`);
  next();
}
