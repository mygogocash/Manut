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
import { jsonForInlineScript } from '../oauth-callback-script';
import { TiktokOAuthService } from './tiktok-oauth.service';

const POSTMESSAGE_TYPE = 'affine:tiktok-oauth-result';

@Controller('/oauth/tiktok')
export class TiktokOAuthController {
  private readonly logger = new Logger(TiktokOAuthController.name);

  constructor(private readonly tiktok: TiktokOAuthService) {}

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
      const { displayName } = await this.tiktok.handleCallback(code, state);
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: true, displayName }));
    } catch (err) {
      this.logger.error(
        'TikTok OAuth callback failed',
        err instanceof Error ? err.stack : String(err)
      );
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: false, error: 'oauth_failed' }));
    }
  }

  private renderResultPage(
    result: { ok: true; displayName: string } | { ok: false; error: string }
  ): string {
    const fallbackQuery = result.ok
      ? `connected=tiktok&name=${encodeURIComponent(result.displayName)}`
      : `error=${encodeURIComponent(result.error)}`;
    const fallbackUrl = `/?settings=analytics-connections&${fallbackQuery}`;

    const payload = jsonForInlineScript({
      type: POSTMESSAGE_TYPE,
      ...result,
    });
    const safeFallbackUrl = jsonForInlineScript(fallbackUrl);

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Connecting TikTok…</title>
  <meta name="referrer" content="strict-origin" />
  <style>body{font:14px system-ui,sans-serif;padding:24px;color:#333}</style>
</head>
<body>
  <p>Finishing up…</p>
  <script>
  (function () {
    var payload = ${payload};
    var fallbackUrl = ${safeFallbackUrl};
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
