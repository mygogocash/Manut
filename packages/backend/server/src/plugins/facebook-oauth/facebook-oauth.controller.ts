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
import { FacebookOAuthService } from './facebook-oauth.service';

const POSTMESSAGE_TYPE = 'affine:facebook-oauth-result';

/**
 * Facebook OAuth callback handler.
 *
 * Lives at `/oauth/facebook/callback` (no `/api` prefix) — mirrors
 * `/oauth/github/callback` and `/oauth/slack/callback` in shape. The
 * existing AFFiNE callback at `/api/oauth/callback` is reserved for
 * the sign-in flow; this is the Manut analytics integrations flow.
 *
 * Public — Facebook's user agent posts here with the auth code; the
 * single-use state token in cache authorizes the exchange.
 */
@Controller('/oauth/facebook')
export class FacebookOAuthController {
  private readonly logger = new Logger(FacebookOAuthController.name);

  constructor(private readonly facebook: FacebookOAuthService) {}

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
      const { displayName } = await this.facebook.handleCallback(code, state);
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: true, displayName }));
    } catch (err) {
      this.logger.error(
        'Facebook OAuth callback failed',
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
      ? `connected=facebook&name=${encodeURIComponent(result.displayName)}`
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
  <title>Connecting Facebook…</title>
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
