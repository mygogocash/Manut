import type { SocialPlatform } from '../../entities/analytics-data.entity';
import { ANALYTICS_PLATFORM_LABELS } from '../../entities/platform-copy';

const KNOWN_PLATFORMS = new Set<SocialPlatform>([
  'FACEBOOK',
  'INSTAGRAM',
  'THREADS',
  'TIKTOK',
  'LINE_VOOM',
  'GOGOCASH',
]);

export function platformSlugToKey(
  slug: string | undefined
): SocialPlatform | null {
  if (!slug) return null;
  const key = slug
    .trim()
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
  return KNOWN_PLATFORMS.has(key as SocialPlatform)
    ? (key as SocialPlatform)
    : null;
}

export function platformDisplayLabel(platform: SocialPlatform): string {
  return ANALYTICS_PLATFORM_LABELS[platform] ?? platform;
}
