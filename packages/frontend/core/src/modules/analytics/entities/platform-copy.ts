import type { SocialPlatform } from './analytics-data.entity';

export const ANALYTICS_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  THREADS: 'Threads',
  TIKTOK: 'TikTok',
  LINE_VOOM: 'LINE Official Account',
  GOGOCASH: 'GoGoCash',
};

export const ANALYTICS_PLATFORM_ACCOUNT_LABELS: Record<SocialPlatform, string> =
  {
    FACEBOOK: 'Facebook Page',
    INSTAGRAM: 'Instagram Business Account',
    THREADS: 'Threads Profile',
    TIKTOK: 'TikTok Account',
    LINE_VOOM: 'LINE Official Account channel',
    GOGOCASH: 'GoGoCash',
  };

export const LINE_CONNECTION_CARD_COPY = {
  name: 'LINE Official Account',
  description:
    'Connect a LINE Official Account channel for Messaging API events and available channel metrics. VOOM post analytics stay hidden until LINE confirms API access.',
} as const;
