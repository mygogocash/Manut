import { defineModuleConfig } from '../../base';

/**
 * Consolidated analytics module config.
 *
 * Round C ended up with three sibling namespaces (`analytics.kms`,
 * `analyticsLine.*`, `analyticsMeta.*`, plus a runtime-cast `analytics.tiktok`)
 * because TypeScript declaration merging does NOT recursively merge nested
 * object types within an interface. Agent 8 worked around the TikTok side
 * with a runtime cast and asked the integration round to consolidate.
 *
 * This file is the single source of truth for analytics config. All
 * sub-modules (token-store, OAuth services, webhook controllers) read from
 * `config.analytics.<platform>.<key>`.
 */
declare global {
  interface AppConfigSchema {
    analytics: {
      kms: ConfigItem<{
        keyName: string;
      }>;
      meta: ConfigItem<{
        appId: string;
        appSecret: string;
        callbackUrl: string;
        webhookVerifyToken: string;
      }>;
      line: ConfigItem<{
        channelId: string;
        channelSecret: string;
        channelAccessToken: string;
        callbackUrl: string;
      }>;
      tiktok: ConfigItem<{
        clientKey: string;
        clientSecret: string;
        callbackUrl: string;
      }>;
    };
  }
}

defineModuleConfig('analytics', {
  kms: {
    desc: 'GCP KMS settings for the analytics token store. `keyName` is the full resource name, e.g. projects/<id>/locations/<loc>/keyRings/<ring>/cryptoKeys/<key>.',
    default: {
      keyName: '',
    },
  },
  meta: {
    desc: 'Meta App credentials shared across Facebook, Instagram and Threads. Used for OAuth and HMAC-SHA256 webhook verification.',
    default: {
      appId: '',
      appSecret: '',
      callbackUrl: '',
      webhookVerifyToken: '',
    },
    link: 'https://developers.facebook.com/apps/',
  },
  line: {
    desc: 'LINE Login + Messaging API credentials. `channelSecret` is used for both OAuth code exchange and HMAC-SHA256 webhook verification.',
    default: {
      channelId: '',
      channelSecret: '',
      channelAccessToken: '',
      callbackUrl: '',
    },
    link: 'https://developers.line.biz/console/',
  },
  tiktok: {
    desc: 'TikTok Login Kit credentials (Display-API tier). See docs/analytics-approvals.md §2.',
    default: {
      clientKey: '',
      clientSecret: '',
      callbackUrl: '',
    },
  },
});
