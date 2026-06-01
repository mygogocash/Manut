import type { SocialEvent } from '../../entities/analytics-data.entity';

export type PlatformRecentEvent = SocialEvent;

const TEXT_KEYS = ['text', 'message', 'caption', 'title', 'content', 'excerpt'];

export function buildEventMessage(event: PlatformRecentEvent): string {
  for (const key of TEXT_KEYS) {
    const value = event.payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  const metricSummary = summarizeMetrics(event.payload.metrics);
  if (metricSummary) {
    return metricSummary;
  }

  return `${eventTypeLabel(event.eventType)} · ${event.externalId}`;
}

function summarizeMetrics(metrics: unknown): string | null {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    return null;
  }

  const parts = Object.entries(metrics)
    .filter((entry): entry is [string, number] => {
      return typeof entry[1] === 'number' && Number.isFinite(entry[1]);
    })
    .slice(0, 3)
    .map(([key, value]) => `${metricLabel(key)} ${value.toLocaleString()}`);

  return parts.length > 0 ? parts.join(' · ') : null;
}

function eventTypeLabel(eventType: string): string {
  const words = eventType
    .split(/[._-]+/g)
    .filter(Boolean)
    .map(part => part.toLowerCase());
  const sentence = words.join(' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function metricLabel(metricKey: string): string {
  return metricKey
    .split(/[._-]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
