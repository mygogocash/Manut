/** Worker bindings + vars. Keep in sync with wrangler.jsonc. */
export type Bindings = {
  ASSETS: Fetcher;
  HYPERDRIVE: Hyperdrive;
  KV_SESSIONS: KVNamespace;
  KV_CACHE: KVNamespace;
  R2_PUBLIC: R2Bucket;
  R2_PRIVATE: R2Bucket;
  JOBS_QUEUE: Queue;
  RATE_LIMITER_LOGIN?: RateLimit;
  RATE_LIMITER_GLOBAL?: RateLimit;
  // vars
  APP_URL: string;
  TRUSTED_ORIGINS?: string;
  POSTHOG_HOST: string;
  POSTHOG_ASSETS_HOST: string;
  MAGIC_LINK_ALLOWED_ROLES?: string;
  // secrets (wrangler secret put …)
  BETTER_AUTH_SECRET: string;
  TURNSTILE_SECRET?: string;
  EMAIL_SERVICE_URL?: string;
  EMAIL_SERVICE_API_KEY?: string;
  VALIDATOR_MONITOR_GITHUB_TOKEN?: string;
  VALIDATOR_MONITOR_REPO?: string;
  VALIDATOR_MONITOR_BRANCH?: string;
  VALIDATOR_MONITOR_FILE?: string;
  CRON_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  MARKETING_ANALYTICS_ENABLED?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GEMINI_API_KEY?: string;
  BOT_API_CLIENT_ID?: string;
  BOT_API_BASE_URL?: string;
  BOT_FX_CURRENCIES?: string;
  BOT_FX_UNITS?: string;
  FX_FALLBACK_ENABLED?: string;
  FX_FALLBACK_API_KEY?: string;
  FX_FALLBACK_BASE_URL?: string;
  ACCOUNTING_FIXED_ASSETS?: string;
  ACCOUNTING_GL_POSTING?: string;
};

/** Minimal shape of the Rate Limiting binding (not yet in workers-types). */
export type RateLimit = { limit(options: { key: string }): Promise<{ success: boolean }> };
