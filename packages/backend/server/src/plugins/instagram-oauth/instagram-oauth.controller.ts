import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../core/auth';
import { InstagramOAuthService } from './instagram-oauth.service';

const POSTMESSAGE_TYPE = 'affine:instagram-oauth-result';

/**
 * Instagram OAuth callback handler.
 *
 * Lives at `/oauth/instagram/callback`. Mirrors the Facebook callback
 * controller in shape. Public — Instagram's user agent posts here.
 */
@Controller('/oauth/instagram')
export class InstagramOAuthController {
  private readonly logger = new Logger(InstagramOAuthController.name);

  constructor(private readonly instagram: InstagramOAuthService) {}

  @Public()
  @Get('/callback')
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string
  ) {
    if (error) {
      return res.status(HttpStatus.OK).send(
        this.renderResultPage({
          ok: false,
          error: errorDescription ?? error,
        })
      );
    }

    if (!code || !state) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(this.renderResultPage({ ok: false, error: 'invalid_callback' }));
    }

    try {
      const { username } = await this.instagram.handleCallback(code, state);
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: true, username }));
    } catch (err) {
      this.logger.error(
        'Instagram OAuth callback failed',
        err instanceof Error ? err.stack : String(err)
      );
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: false, error: 'oauth_failed' }));
    }
  }

  private renderResultPage(
    result: { ok: true; username: string } | { ok: false; error: string }
  ): string {
    const fallbackQuery = result.ok
      ? `connected=instagram&username=${encodeURIComponent(result.username)}`
      : `error=${encodeURIComponent(result.error)}`;
    const fallbackUrl = `/?settings=analytics-connections&${fallbackQuery}`;

    const payload = JSON.stringify({
      type: POSTMESSAGE_TYPE,
      ...result,
    });

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Connecting Instagram…</title>
  <meta name="referrer" content="strict-origin" />
  <style>body{font:14px system-ui,sans-serif;padding:24px;color:#333}</style>
</head>
<body>
  <p>Finishing up…</p>
  <script>
  (function () {
    var payload = ${payload};
    var fallbackUrl = ${JSON.stringify(fallbackUrl)};
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(payload, window.location.origin);
        window.close();
        return;
      }
    } catch (e) { /* fall through */ }
    window.location.replace(fallbackUrl);
  })();
  </script>
</body>
</html>`;
  }
}
