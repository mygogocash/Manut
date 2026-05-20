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
import { LinearOAuthService } from './linear-oauth.service';

const POSTMESSAGE_TYPE = 'affine:linear-oauth-result';

/**
 * Linear OAuth callback handler.
 *
 * Lives at `/oauth/linear/callback` — Linear's OAuth app config
 * registers a fixed redirect URI and the existing AFFiNE callback at
 * `/api/oauth/callback` is reserved for the sign-in flow. Mirrors
 * `/oauth/github/callback` in shape.
 *
 * The frontend opens the consent URL in a popup; this handler
 * postMessages the result back to the opener and falls back to a
 * same-origin redirect to /workspace settings if there's no opener.
 *
 * Public — Linear's user agent posts here with the auth code; the
 * single-use state token in cache authorizes the exchange.
 */
@Controller('/oauth/linear')
export class LinearOAuthController {
  private readonly logger = new Logger(LinearOAuthController.name);

  constructor(private readonly linear: LinearOAuthService) {}

  @Public()
  @Get('/callback')
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string
  ) {
    if (error) {
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: false, error }));
    }

    if (!code || !state) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(this.renderResultPage({ ok: false, error: 'invalid_callback' }));
    }

    try {
      const { displayName, organizationName } =
        await this.linear.handleCallback(code, state);
      return res
        .status(HttpStatus.OK)
        .send(
          this.renderResultPage({ ok: true, displayName, organizationName })
        );
    } catch (err) {
      this.logger.error(
        'Linear OAuth callback failed',
        err instanceof Error ? err.stack : String(err)
      );
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: false, error: 'oauth_failed' }));
    }
  }

  /**
   * Render a tiny HTML page that postMessages the OAuth outcome to
   * the opener (popup pattern) and falls back to a same-origin
   * redirect when there's no opener.
   */
  private renderResultPage(
    result:
      | { ok: true; displayName: string; organizationName: string }
      | { ok: false; error: string }
  ): string {
    const fallbackQuery = result.ok
      ? `connected=linear&user=${encodeURIComponent(result.displayName)}&org=${encodeURIComponent(result.organizationName)}`
      : `error=${encodeURIComponent(result.error)}`;
    const fallbackUrl = `/?settings=integrations&${fallbackQuery}`;

    const payload = JSON.stringify({
      type: POSTMESSAGE_TYPE,
      ...result,
    });

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Connecting Linear…</title>
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
