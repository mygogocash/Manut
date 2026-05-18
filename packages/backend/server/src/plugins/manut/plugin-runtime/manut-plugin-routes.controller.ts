import {
  All,
  Body,
  Controller,
  Headers,
  HttpException,
  Logger,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { ManutPluginRuntimeService } from './manut-plugin-runtime.service';

/**
 * Plugin-scoped HTTP mount.
 *
 * Every plugin route is namespaced under
 * `/api/plugins/:pluginId/api/*` so a plugin CANNOT shadow core
 * endpoints by accident. We bridge each request into the active
 * plugin worker via the JSON-RPC bridge and stream the response
 * back as JSON.
 *
 * Auth inheritance: NestJS guards declared on `/api/*` apply to this
 * mount the same way they apply to every other controller, so the
 * caller's identity reaches the plugin already authenticated. The
 * plugin worker NEVER sees raw cookies or tokens — only the JSON
 * body, query string, and a curated header map.
 */
@Controller('/api/plugins/:pluginId/api')
export class ManutPluginRoutesController {
  private readonly logger = new Logger(ManutPluginRoutesController.name);

  /**
   * Headers that may be forwarded into the plugin without revealing
   * privileged auth material. Everything else is dropped.
   */
  private readonly allowedHeaders = new Set([
    'accept',
    'accept-language',
    'content-type',
    'x-request-id',
    'x-workspace-id',
  ]);

  constructor(private readonly runtime: ManutPluginRuntimeService) {}

  @All('*')
  async dispatch(
    @Param('pluginId') pluginId: string,
    @Headers() headers: Record<string, string>,
    @Body() body: unknown,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    // The wildcard route path (relative to the controller mount) lives
    // in `req.params[0]` for the `*` segment. Normalise to a leading
    // slash so the plugin sees `/echo` rather than `echo`.
    const rawPath =
      (req.params as Record<string, string | undefined>)['0'] ?? '';
    const subPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

    const sanitisedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (this.allowedHeaders.has(key.toLowerCase())) {
        sanitisedHeaders[key.toLowerCase()] = value;
      }
    }

    try {
      const result = await this.runtime.callRoute({
        pluginId,
        method: req.method,
        path: subPath,
        headers: sanitisedHeaders,
        body,
      });
      res.status(200).json(result);
    } catch (err: unknown) {
      // Translate runtime errors into HTTP. The bridge throws plain
      // Error subclasses with a `code` property — map known codes to
      // matching HTTP statuses, default to 500.
      if (err instanceof HttpException) {
        throw err;
      }
      if (err instanceof Error) {
        const code = (err as Error & { code?: string }).code;
        if (code === 'capability_denied') {
          res.status(403).json({ error: { code, message: err.message } });
          return;
        }
        if (code === 'rpc_overflow') {
          res.status(503).json({ error: { code, message: err.message } });
          return;
        }
        if (code === 'rpc_timeout') {
          res.status(504).json({ error: { code, message: err.message } });
          return;
        }
        if (code === 'rpc_disposed') {
          throw new NotFoundException(`plugin ${pluginId} is not active`);
        }
        this.logger.warn(
          `unhandled plugin route error for ${pluginId}: ${err.message}`
        );
        res.status(500).json({
          error: { code: code ?? 'internal_error', message: err.message },
        });
        return;
      }
      res
        .status(500)
        .json({ error: { code: 'internal_error', message: String(err) } });
    }
  }
}
