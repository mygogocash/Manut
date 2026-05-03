import { Button } from '@affine/admin/components/ui/button';
import { cn } from '@affine/admin/utils';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { useCallback, useEffect, useState } from 'react';

import { affineFetch } from '../fetch-utils';
import { Header } from '../modules/header';

interface IndexingStats {
  totalDocs: number;
  indexedDocs: number;
  pendingDocs: number;
  lastCheckAt: string | null;
}

async function fetchIndexingStats(): Promise<IndexingStats> {
  const res = await affineFetch('/api/copilot/admin/indexing/stats');
  if (!res.ok) {
    throw new Error(`Failed to fetch indexing stats: ${res.statusText}`);
  }
  return res.json() as Promise<IndexingStats>;
}

async function triggerReindex(): Promise<void> {
  const res = await affineFetch('/api/copilot/admin/indexing/reindex', {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger reindex: ${res.statusText}`);
  }
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description?: string;
}) {
  return (
    <div className="flex flex-col rounded-md border p-4 gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {description ? (
        <span className="text-xs text-muted-foreground">{description}</span>
      ) : null}
    </div>
  );
}

export function IndexingStatusPage() {
  const [stats, setStats] = useState<IndexingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchIndexingStats()
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleReindex = useCallback(() => {
    setReindexing(true);
    setReindexMessage(null);
    triggerReindex()
      .then(() => {
        setReindexMessage(
          'Re-index triggered successfully. Missing docs will be queued shortly.'
        );
        setReindexing(false);
        // Reload stats after a short delay so new pending count is visible.
        setTimeout(loadStats, 2000);
      })
      .catch((err: unknown) => {
        setReindexMessage(
          err instanceof Error ? err.message : 'Failed to trigger reindex'
        );
        setReindexing(false);
      });
  }, [loadStats]);

  const percentIndexed =
    stats && stats.totalDocs > 0
      ? Math.round((stats.indexedDocs / stats.totalDocs) * 100)
      : stats?.totalDocs === 0
        ? 100
        : 0;

  const lastCheckDisplay = stats?.lastCheckAt
    ? new Date(stats.lastCheckAt).toLocaleString()
    : 'Not yet run';

  return (
    <div className="h-dvh flex-1 flex-col flex">
      <Header title="Indexing Status" />
      <ScrollAreaPrimitive.Root
        className={cn('relative overflow-hidden w-full')}
      >
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
          <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Embedding Indexing Status</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Shows the current state of workspace doc embeddings used by AI
                search and context features. The health-check job runs
                automatically every hour.
              </p>
            </div>

            {error ? (
              <div className="rounded-md border border-destructive p-4 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {loading && !stats ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total docs" value={stats.totalDocs} />
                <StatCard label="Indexed docs" value={stats.indexedDocs} />
                <StatCard label="Pending docs" value={stats.pendingDocs} />
                <StatCard
                  label="Coverage"
                  value={`${percentIndexed}%`}
                  description="indexed / total"
                />
              </div>
            ) : null}

            <div className="flex flex-col rounded-md border p-4 gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Manual Re-index</p>
                  <p className="text-sm text-muted-foreground">
                    Scans all workspaces and re-queues any docs missing
                    embeddings. This runs in the background.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last health-check: {lastCheckDisplay}
                  </p>
                </div>
                <Button
                  onClick={handleReindex}
                  disabled={reindexing || loading}
                  variant="outline"
                >
                  {reindexing ? 'Triggering…' : 'Reindex All'}
                </Button>
              </div>
              {reindexMessage ? (
                <p className="text-sm text-muted-foreground">{reindexMessage}</p>
              ) : null}
            </div>

            <Button variant="ghost" size="sm" onClick={loadStats} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh stats'}
            </Button>
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollAreaPrimitive.ScrollAreaScrollbar
          className={cn(
            'flex touch-none select-none transition-colors',
            'h-full w-2.5 border-l border-l-transparent p-[1px]'
          )}
        >
          <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
        </ScrollAreaPrimitive.ScrollAreaScrollbar>
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    </div>
  );
}
