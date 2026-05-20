import { CopilotClient } from '@affine/core/blocksuite/ai';
import { EventSourceService, GraphQLService } from '@affine/core/modules/cloud';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  pickTimeBucket,
  type TimeBucketId,
} from '../../../modules/quicksearch/components/result-group';

// Chat history row — flattened from the GraphQL CopilotHistories edge into the
// minimal shape the sidebar list needs. Keeping the projection narrow avoids
// dragging the full ChatMessage stream into the sidebar bundle (the user
// doesn't see message bodies here, just titles + timestamps).
export interface ChatHistoryRow {
  id: string;
  title: string;
  /** Unix ms — the parsed `updatedAt` from the server response. */
  updatedAt: number;
  /** True when the server has not yet generated a title for this chat. */
  isUntitled: boolean;
}

export interface ChatHistoryBucket {
  id: TimeBucketId;
  label: string;
  rows: readonly ChatHistoryRow[];
}

export type ChatHistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseChatHistoryResult {
  status: ChatHistoryStatus;
  buckets: readonly ChatHistoryBucket[];
  totalCount: number;
  /** Wall clock pinned at load time — used to format relative timestamps. */
  now: number;
  reload: () => void;
}

// Per-bucket order matches the Notion screenshot: most-recent first, with
// `undated` slotted at the bottom for any rows whose timestamp wouldn't
// parse (shouldn't happen with the current schema but we stay defensive).
const BUCKET_LABELS: Record<TimeBucketId, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'past-7-days': 'Past 7 days',
  'past-30-days': 'Past 30 days',
  older: 'Older',
  undated: 'Older',
};

const BUCKET_ORDER: readonly TimeBucketId[] = [
  'today',
  'yesterday',
  'past-7-days',
  'past-30-days',
  'older',
  'undated',
];

// Cap pulled from the server in one shot. Most workspaces won't approach
// this; if they do, virtualisation/pagination is a follow-up. 100 keeps the
// initial paint cheap (~kilobytes of JSON) and matches the conservative
// cap used elsewhere in the chat surfaces.
const HISTORY_PAGE_SIZE = 100;

function parseTimestamp(raw: string | null | undefined): number {
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function projectRow(node: {
  sessionId: string;
  title: string | null;
  updatedAt: string;
}): ChatHistoryRow {
  const trimmed = node.title?.trim() ?? '';
  return {
    id: node.sessionId,
    title: trimmed.length > 0 ? trimmed : 'New chat',
    updatedAt: parseTimestamp(node.updatedAt),
    isUntitled: trimmed.length === 0,
  };
}

interface HistoryNode {
  sessionId: string;
  title: string | null;
  updatedAt: string;
}

function groupByBucket(
  rows: readonly ChatHistoryRow[],
  now: number
): readonly ChatHistoryBucket[] {
  const grouped = new Map<TimeBucketId, ChatHistoryRow[]>();
  for (const row of rows) {
    const bucketId = pickTimeBucket(row.updatedAt, now);
    const list = grouped.get(bucketId);
    if (list) {
      list.push(row);
    } else {
      grouped.set(bucketId, [row]);
    }
  }
  const out: ChatHistoryBucket[] = [];
  for (const id of BUCKET_ORDER) {
    const list = grouped.get(id);
    if (!list || list.length === 0) continue;
    // Most-recent first within each bucket so the visual reading order is
    // consistent regardless of the server's response ordering.
    const sorted: readonly ChatHistoryRow[] = [...list].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    out.push({
      id,
      label: BUCKET_LABELS[id],
      rows: sorted,
    });
  }
  return out;
}

/**
 * Loads the workspace's AI chat sessions from the backend, projects each
 * edge into a minimal `{id, title, updatedAt}` shape, and groups by
 * recency bucket (Today / Yesterday / Past 7 days / Past 30 days / Older).
 *
 * Mounts a fresh `CopilotClient` per workspace and disposes when the
 * effect re-runs. `reload()` retriggers the fetch — used after a new
 * chat row gets created so the sidebar reflects it without a page
 * reload.
 *
 * React 19 preserve-manual-memo discipline: every callback reads fresh
 * state inside its body rather than closing over snapshots. The hook is
 * safe to drop into a memoised parent without stale-state bugs.
 */
export function useChatHistory(): UseChatHistoryResult {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const graphqlService = useService(GraphQLService);
  const eventSourceService = useService(EventSourceService);

  const client = useMemo(
    () => new CopilotClient(graphqlService.gql, eventSourceService.eventSource),
    [graphqlService, eventSourceService]
  );

  const [status, setStatus] = useState<ChatHistoryStatus>('idle');
  const [rows, setRows] = useState<readonly ChatHistoryRow[]>([]);
  // `reloadCounter` is a monotonic trigger — bumping it forces the loader
  // effect to re-run without changing any of its real deps.
  const [reloadCounter, setReloadCounter] = useState(0);
  // Pin "now" once per load so all rows fall into a stable bucket relative
  // to the same wall clock. Storing in React state (rather than a ref)
  // ensures consumers see the updated value and can use it as a render
  // input without tripping React 19's manual-memo guard.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setNow(Date.now());
    const run = async () => {
      try {
        const nodes = (await client.getHistories(
          workspaceId,
          { first: HISTORY_PAGE_SIZE },
          undefined,
          {
            // Title + timestamps only — no message bodies. The server
            // honors `withMessages: false` by returning an empty array
            // for that field, which keeps the payload small.
            withMessages: false,
            withPrompt: false,
          }
        )) as readonly HistoryNode[] | undefined;
        if (cancelled) return;
        const projected = (nodes ?? []).map(projectRow);
        setRows(projected);
        setStatus('ready');
      } catch {
        if (cancelled) return;
        // Sidebar surface — we degrade quietly to the empty state rather
        // than surfacing a toast. The chat panel itself will re-attempt
        // and surface auth errors via the existing AIProvider login
        // flow when the user actually opens it.
        setRows([]);
        setStatus('error');
      }
    };
    // oxlint typescript-eslint(no-floating-promises): pair `void` with a
    // terminal `.catch()` so the rule doesn't fire even though the async
    // body already swallows errors via its own try/catch.
    void run().catch(() => {
      // unreachable — `run` already catches.
    });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, reloadCounter]);

  const buckets = useMemo(() => groupByBucket(rows, now), [rows, now]);

  const reload = useCallback(() => {
    setReloadCounter(prev => prev + 1);
  }, []);

  return {
    status,
    buckets,
    totalCount: rows.length,
    now,
    reload,
  };
}
