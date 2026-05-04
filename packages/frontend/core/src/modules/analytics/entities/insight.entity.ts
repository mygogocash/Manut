import { Entity, LiveData } from '@toeverything/infra';

import type { SocialPlatform } from './analytics-data.entity';

/**
 * Mirrors backend `InsightType` GraphQL enum.
 * Backend may also expose other values (e.g. CONTENT_RECOMMENDATION). The
 * union is intentionally string-broadened so unknown types from the server
 * still flow through.
 */
export type InsightType =
  | 'WEEKLY_STRATEGY'
  | 'TREND'
  | 'ANOMALY'
  | 'RECOMMENDATION'
  | 'CONTENT_RECOMMENDATION'
  | (string & {});

export type InsightSeverity = 'INFO' | 'NOTABLE' | 'ACTION_REQUIRED';

/**
 * Mirrors backend `SocialInsight` DTO. Field names follow the GraphQL
 * schema: `insightType` instead of the legacy `type`. We keep `type` as
 * an optional alias so older code still type-checks while migrating.
 */
export interface Insight {
  id: string;
  workspaceId: string;
  insightType: InsightType;
  /** Legacy alias — kept optional for back-compat. New code uses `insightType`. */
  type?: InsightType;
  severity: InsightSeverity;
  title: string;
  body: string;
  platforms: SocialPlatform[];
  modelUsed?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
}

/**
 * InsightEntity holds the AI-generated insights timeline for the workspace.
 * Round-C wiring: data is provided externally via `setInsights` from
 * AnalyticsService.loadInsights. Subscriptions push new items via
 * `addInsightToTop` so the UI can animate them in.
 */
export class InsightEntity extends Entity {
  readonly insights$ = new LiveData<Insight[]>([]);
  readonly loading$ = new LiveData<boolean>(false);
  readonly error$ = new LiveData<string | null>(null);

  setLoading(loading: boolean): void {
    this.loading$.next(loading);
  }

  setError(error: string | null): void {
    this.error$.next(error);
  }

  setInsights(insights: Insight[]): void {
    this.insights$.next(insights);
  }

  /** Prepend a single insight (used by subscription + content-recommendation). */
  addInsightToTop(insight: Insight): void {
    const current = this.insights$.value;
    // De-dup by id — subscriptions can race with the initial load.
    const filtered = current.filter(i => i.id !== insight.id);
    this.insights$.next([insight, ...filtered]);
  }

  /** Mark an insight acknowledged in-place (immutable update). */
  acknowledgeLocally(id: string, acknowledgedAt: string): void {
    const current = this.insights$.value;
    this.insights$.next(
      current.map(i => (i.id === id ? { ...i, acknowledgedAt } : i))
    );
  }
}
