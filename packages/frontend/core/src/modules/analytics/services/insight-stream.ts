import type { EventSourceService } from '@affine/core/modules/cloud';

import type { Insight, InsightSeverity } from '../entities/insight.entity';

function parseInsightEvent(raw: unknown, workspaceId: string): Insight | null {
  if (!raw || typeof raw !== 'object') return null;
  const event = raw as Record<string, unknown>;
  if (event.workspaceId !== workspaceId) return null;
  const insight = event.insight;
  if (!insight || typeof insight !== 'object') return null;
  const candidate = insight as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.insightType !== 'string' ||
    !Array.isArray(candidate.platforms) ||
    !candidate.platforms.every(platform => typeof platform === 'string') ||
    typeof candidate.title !== 'string' ||
    typeof candidate.body !== 'string' ||
    typeof candidate.severity !== 'string' ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    workspaceId,
    insightType: candidate.insightType,
    severity: candidate.severity as InsightSeverity,
    title: candidate.title,
    body: candidate.body,
    platforms: candidate.platforms,
    modelUsed:
      typeof candidate.modelUsed === 'string' ? candidate.modelUsed : null,
    createdAt: candidate.createdAt,
    acknowledgedAt:
      typeof candidate.acknowledgedAt === 'string'
        ? candidate.acknowledgedAt
        : null,
  };
}

export function subscribeInsightStream(
  eventSourceService: EventSourceService,
  workspaceId: string,
  onInsight: (insight: Insight) => void
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const url = `/api/workspace/${encodeURIComponent(workspaceId)}/analytics/insights-stream`;
  let source: EventSource | null;
  try {
    source = eventSourceService.eventSource(url, { withCredentials: true });
  } catch {
    return () => {};
  }

  const onMessage = (raw: MessageEvent<string>) => {
    if (!raw.data) return;
    try {
      const parsed = JSON.parse(raw.data);
      const insight = parseInsightEvent(parsed, workspaceId);
      if (insight) {
        onInsight(insight);
      }
    } catch {
      // Malformed frame — drop without breaking EventSource reconnect.
    }
  };

  source.addEventListener('insight', onMessage as EventListener);
  source.onmessage = onMessage;
  source.onerror = () => {
    // EventSource reconnects natively; no UI error needed for live garnish.
  };

  return () => {
    source?.close();
    source = null;
  };
}
