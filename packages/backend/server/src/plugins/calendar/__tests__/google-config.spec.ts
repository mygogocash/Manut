import test from 'ava';

import type { Config } from '../../../base';
import { resolveGoogleCalendarConfig } from '../providers/google';

function makeConfig(
  overrides: {
    calendar?: Partial<Config['calendar']>;
    oauth?: Partial<Config['oauth']>;
  } = {}
): Config {
  return {
    calendar: {
      google: {
        enabled: false,
        clientId: '',
        clientSecret: '',
        externalWebhookUrl: '',
        webhookVerificationToken: '',
        requestTimeoutMs: 10_000,
      },
      caldav: {
        enabled: false,
        allowCustomProvider: false,
        providers: [],
        allowInsecureHttp: false,
        allowedHosts: [],
        blockPrivateNetwork: true,
        requestTimeoutMs: 10_000,
        maxRedirects: 5,
      },
      ...overrides.calendar,
    },
    oauth: {
      providers: {
        google: { clientId: '', clientSecret: '' },
        github: { clientId: '', clientSecret: '' },
        apple: { clientId: '', clientSecret: '' },
        oidc: { clientId: '', clientSecret: '', issuer: '', args: {} },
        ...overrides.oauth?.providers,
      },
    },
  } as unknown as Config;
}

test('resolveGoogleCalendarConfig prefers explicit calendar.google', t => {
  const config = makeConfig({
    calendar: {
      google: {
        enabled: true,
        clientId: 'calendar-id',
        clientSecret: 'calendar-secret',
        externalWebhookUrl: '',
        webhookVerificationToken: '',
        requestTimeoutMs: 10_000,
      },
    },
    oauth: {
      providers: {
        google: { clientId: 'oauth-id', clientSecret: 'oauth-secret' },
      },
    },
  });

  const resolved = resolveGoogleCalendarConfig(config);
  t.is(resolved?.clientId, 'calendar-id');
  t.is(resolved?.clientSecret, 'calendar-secret');
});

test('resolveGoogleCalendarConfig falls back to oauth.providers.google', t => {
  const config = makeConfig({
    oauth: {
      providers: {
        google: { clientId: 'oauth-id', clientSecret: 'oauth-secret' },
      },
    },
  });

  const resolved = resolveGoogleCalendarConfig(config);
  t.true(resolved?.enabled);
  t.is(resolved?.clientId, 'oauth-id');
  t.is(resolved?.clientSecret, 'oauth-secret');
});

test('resolveGoogleCalendarConfig falls back to GOOGLE_OAUTH_* env vars', t => {
  const prevId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const prevSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'env-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'env-secret';

  try {
    const resolved = resolveGoogleCalendarConfig(makeConfig());
    t.true(resolved?.enabled);
    t.is(resolved?.clientId, 'env-id');
    t.is(resolved?.clientSecret, 'env-secret');
  } finally {
    if (prevId === undefined) {
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    } else {
      process.env.GOOGLE_OAUTH_CLIENT_ID = prevId;
    }
    if (prevSecret === undefined) {
      delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = prevSecret;
    }
  }
});
