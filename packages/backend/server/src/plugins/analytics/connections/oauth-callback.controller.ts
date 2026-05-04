import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../../core/auth';
import { ConnectionService } from './connection.service';

/**
 * REST controller for the analytics OAuth callback. The provider redirects
 * the user's browser here with `?code=…&state=…`. We complete the flow
 * server-side and return a tiny HTML page that posts a message to the
 * opener window and closes itself — the connections settings page reads
 * that message and refreshes its list.
 *
 * The route is `/api/integrations/oauth/callback/:platform`. The `:platform`
 * segment is informational only — the actual platform is encoded in the
 * signed `state` token. We accept any value so we can register a single
 * redirect URI per provider and route them all through this one handler.
 */
@Controller('/api/integrations/oauth/callback')
export class OAuthCallbackController {
  private readonly logger = new Logger(OAuthCallbackController.name);

  constructor(private readonly connections: ConnectionService) {}

  @Public()
  @Get(':platform')
  async callback(
    @Param('platform') platform: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') errorCode: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    void platform;

    if (errorCode) {
      const message = errorDescription ?? errorCode;
      this.logger.warn(
        `OAuth callback received provider error: ${errorCode} ${
          errorDescription ?? ''
        }`
      );
      this.respondHtml(res, 'analytics:oauth:error', message);
      return;
    }

    if (!code || !state) {
      this.respondHtml(
        res,
        'analytics:oauth:error',
        'Missing code or state parameter'
      );
      return;
    }

    try {
      await this.connections.completeOAuth(state, code);
      this.respondHtml(res, 'analytics:oauth:done');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'OAuth completion failed';
      this.logger.warn(
        `OAuth completion failed: ${
          err instanceof Error ? err.stack : String(err)
        }`
      );
      this.respondHtml(res, 'analytics:oauth:error', message);
    }
  }

  private respondHtml(
    res: Response,
    type: 'analytics:oauth:done' | 'analytics:oauth:error',
    message?: string
  ): void {
    const body = JSON.stringify({
      type,
      ...(message ? { message } : {}),
    });
    const html = `<!doctype html><meta charset="utf-8"><title>OAuth complete</title><script>(function(){try{window.opener&&window.opener.postMessage(${body},'*');}catch(e){}window.close();})();</script><p>You can close this window.</p>`;
    res.status(200).type('text/html').send(html);
  }
}
