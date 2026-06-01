import { Modal } from '@affine/component';
import { DebugLogger } from '@affine/debug';
import type { SocialPlatform as GqlSocialPlatform } from '@affine/graphql';
import { useLiveData, useService } from '@toeverything/infra';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { WorkspaceService } from '../../../workspace';
import { InsightCard } from '../../components/insight-card';
import type { SocialPlatform } from '../../entities/analytics-data.entity';
import type { Insight } from '../../entities/insight.entity';
import { AnalyticsService } from '../../services/analytics.service';
import * as styles from './index.css';

const logger = new DebugLogger('analytics');

// Platforms the recommendation prompt can target. Mirrors the GraphQL
// `SocialPlatform` enum. GOGOCASH is internal/diagnostic so we omit it
// from the UI picker — the recommendation prompt is a content/marketing
// tool aimed at outward-facing social presences.
const RECOMMENDATION_PLATFORMS: ReadonlyArray<{
  value: SocialPlatform;
  label: string;
}> = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'THREADS', label: 'Threads' },
  { value: 'LINE_VOOM', label: 'LINE VOOM' },
];

// Stable empty-array reference so `useMemo` deps don't re-trigger on every
// render when LiveData returns nothing. Module-scoped const = same identity.
const EMPTY_INSIGHTS: readonly Insight[] = Object.freeze([]);

/* ------------------------------------------------------------------ */
/* Lightweight markdown renderer.                                      */
/* The codebase has BlockSuite's MarkdownAdapter for full doc text but  */
/* no general-purpose React markdown component, so for short insight    */
/* bodies we render a minimal subset inline: paragraphs, **bold**,      */
/* *italic*, `code`, and [text](url) links. Anything else falls through */
/* as plain text — safe by default because we never use innerHTML.      */
/* ------------------------------------------------------------------ */

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  // Use String.matchAll for clarity; regex has /g flag.
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      out.push(text.slice(lastIndex, start));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      out.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      out.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      out.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        // Only render http(s)/mailto — everything else falls back to '#'.
        const safe = /^(https?:|mailto:)/i.test(href) ? href : '#';
        out.push(
          <a key={key++} href={safe} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      } else {
        out.push(token);
      }
    } else {
      out.push(token);
    }
    lastIndex = start + token.length;
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }
  return out;
}

function MarkdownText({ children }: { children: string }) {
  // Split on blank lines into paragraphs; each line within a paragraph
  // becomes a soft break.
  const paragraphs = useMemo(
    () =>
      children
        .replace(/\r\n/g, '\n')
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean),
    [children]
  );
  return (
    <>
      {paragraphs.map((p, i) => {
        const lines = p.split('\n');
        return (
          <p key={i} className={styles.paragraph}>
            {lines.map((line, li) => (
              <span key={li}>
                {renderInline(line)}
                {li < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Date grouping.                                                      */
/* ------------------------------------------------------------------ */

type Bucket = 'Today' | 'Yesterday' | 'This Week' | 'Older';
const BUCKET_ORDER: Bucket[] = ['Today', 'Yesterday', 'This Week', 'Older'];

function bucketFor(iso: string, now = new Date()): Bucket {
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) return 'Older';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(
    startOfToday.getTime() - 24 * 60 * 60 * 1000
  );
  const startOfWeek = new Date(
    startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000
  );
  if (ts >= startOfToday) return 'Today';
  if (ts >= startOfYesterday) return 'Yesterday';
  if (ts >= startOfWeek) return 'This Week';
  return 'Older';
}

function groupInsights(insights: Insight[]): Map<Bucket, Insight[]> {
  const sorted = [...insights].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const map = new Map<Bucket, Insight[]>();
  for (const b of BUCKET_ORDER) map.set(b, []);
  for (const insight of sorted) {
    const bucket = map.get(bucketFor(insight.createdAt));
    if (bucket) bucket.push(insight);
  }
  return map;
}

/* ------------------------------------------------------------------ */

export function AIStrategist() {
  const analyticsService = useService(AnalyticsService);
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const insights =
    useLiveData(analyticsService.insights.insights$) ?? EMPTY_INSIGHTS;
  const loading = useLiveData(analyticsService.insights.loading$) ?? false;
  const error = useLiveData(analyticsService.insights.error$);

  const [busyAcknowledgeId, setBusyAcknowledgeId] = useState<string | null>(
    null
  );
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [recPlatform, setRecPlatform] = useState<SocialPlatform>(
    RECOMMENDATION_PLATFORMS[0].value
  );
  const [recTone, setRecTone] = useState('');
  const [recBusy, setRecBusy] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const freshIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    analyticsService.loadInsights(workspaceId).catch(err => {
      logger.error('loadInsights failed', err);
    });
    const unsub = analyticsService.subscribeToInsights(workspaceId, insight => {
      freshIdsRef.current.add(insight.id);
    });
    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  }, [analyticsService, workspaceId]);

  const grouped = useMemo(() => groupInsights(insights), [insights]);

  const handleAcknowledge = useCallback(
    async (insightId: string) => {
      setBusyAcknowledgeId(insightId);
      try {
        await analyticsService.acknowledgeInsight(insightId);
      } catch (err) {
        logger.error('acknowledgeInsight failed', err);
      } finally {
        setBusyAcknowledgeId(null);
      }
    },
    [analyticsService]
  );

  const handleCopyLink = useCallback(
    (insightId: string) => {
      const url = `${window.location.origin}/workspace/${workspaceId}/analytics/ai-strategist#insight-${insightId}`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).catch(() => {
          /* clipboard write can reject under permissions policy; ignore */
        });
      }
    },
    [workspaceId]
  );

  const handleRunRecommendation = useCallback(async () => {
    setRecBusy(true);
    setRecError(null);
    try {
      // Local `SocialPlatform` is a string-union (entity type), the
      // wire/service expects the codegen `SocialPlatform` enum. Values
      // are byte-identical, so the runtime conversion is a no-op cast.
      const insight = await analyticsService.runContentRecommendation(
        workspaceId,
        recPlatform as unknown as GqlSocialPlatform,
        recTone
      );
      freshIdsRef.current.add(insight.id);
      setRecTone('');
      setRecModalOpen(false);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRecBusy(false);
    }
  }, [analyticsService, recPlatform, recTone, workspaceId]);

  const renderBody = useCallback(
    (body: string) => <MarkdownText>{body}</MarkdownText>,
    []
  );

  return (
    <div className={styles.root} data-testid="analytics-ai-strategist">
      <div className={styles.headerBar}>
        <div>
          <div className={styles.title}>AI Strategist</div>
          <div className={styles.subtitle}>
            AI-generated insights, anomalies, and weekly strategies for your
            social presence.
          </div>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setRecModalOpen(true)}
          disabled={recBusy}
          data-testid="analytics-generate-content-recommendation"
        >
          Generate Content Recommendation
        </button>
      </div>

      {loading && insights.length === 0 ? (
        <div
          className={styles.skeleton}
          data-testid="analytics-ai-strategist-loading"
        >
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
        </div>
      ) : error ? (
        <div className={styles.empty}>Could not load insights: {error}</div>
      ) : insights.length === 0 ? (
        <div
          className={styles.empty}
          data-testid="analytics-ai-strategist-empty"
        >
          No insights yet. Insights are generated weekly and on anomaly
          detection. You can also generate a content recommendation right now.
        </div>
      ) : (
        <div className={styles.groups}>
          {BUCKET_ORDER.map(bucket => {
            const bucketInsights = grouped.get(bucket) ?? [];
            if (bucketInsights.length === 0) return null;
            return (
              <section key={bucket} className={styles.group}>
                <div className={styles.groupLabel}>{bucket}</div>
                <div className={styles.list}>
                  {bucketInsights.map(insight => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      renderBody={renderBody}
                      onAcknowledge={handleAcknowledge}
                      onCopyLink={handleCopyLink}
                      busy={busyAcknowledgeId === insight.id}
                      fresh={freshIdsRef.current.has(insight.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/*
        Shared Modal (Radix Dialog) provides focus-trap, Escape-to-close,
        aria-modal, and click-outside for free. `persistent` while busy
        keeps the dialog open mid-generation (Escape/click-outside no-op),
        matching the previous hand-rolled `!recBusy` guard. The platform
        <select> is auto-focused on open (Radix focuses the first tabbable
        element unless disabled).
      */}
      <Modal
        open={recModalOpen}
        onOpenChange={setRecModalOpen}
        persistent={recBusy}
        width={420}
        title="Generate Content Recommendation"
        contentOptions={{
          'data-testid': 'analytics-content-recommendation-modal',
        }}
      >
        <div className={styles.modalBody}>
          <label className={styles.label} htmlFor="rec-platform">
            Platform
          </label>
          <select
            id="rec-platform"
            className={styles.input}
            value={recPlatform}
            onChange={e => setRecPlatform(e.target.value as SocialPlatform)}
            disabled={recBusy}
            data-testid="analytics-content-recommendation-platform"
          >
            {RECOMMENDATION_PLATFORMS.map(p => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <label className={styles.label} htmlFor="rec-tone">
            Tone (optional)
          </label>
          <input
            id="rec-tone"
            className={styles.input}
            placeholder="e.g. playful, professional, urgent"
            value={recTone}
            onChange={e => setRecTone(e.target.value)}
            disabled={recBusy}
            data-testid="analytics-content-recommendation-tone"
          />
          {recError ? <div className={styles.error}>{recError}</div> : null}
        </div>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setRecModalOpen(false)}
            disabled={recBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handleRunRecommendation()}
            disabled={recBusy}
            data-testid="analytics-content-recommendation-submit"
          >
            {recBusy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
