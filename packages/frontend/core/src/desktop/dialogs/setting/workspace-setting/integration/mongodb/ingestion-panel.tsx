import { Button } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  deleteMongoIngestionConfigMutation,
  listMongoCollectionsQuery,
  type MongoCollectionInfoDto,
  type MongoSampleDocsDto,
  sampleMongoCollectionQuery,
  setMongoIngestionConfigMutation,
} from '../../analytics-connections/graphql';
import * as styles from './ingestion-panel.css';

/**
 * MongoDB ingestion picker — Manut analytics Wave 2 / M3 E3.4.
 *
 * Lists every collection in the connected Mongo cluster, lets the
 * user toggle which ones to ingest, override the cursor field
 * (default `updatedAt`), and inspect up to 5 sample documents per
 * collection before opting in.
 *
 * Concurrency model:
 *  - Local state shadows the saved configuration; toggle / cursor-field
 *    edits mutate local-only until the user clicks Save.
 *  - "Save changes" diffs local vs server, issues one mutation per
 *    changed row, then refetches the collection list (which joins on
 *    the saved configs server-side, so the row state stays in sync
 *    with the picker UI).
 *  - Sample-doc fetching is on-demand per row — we don't pre-load
 *    samples for every collection because that's N round-trips at
 *    expand-time the user may never click.
 *
 * Errors:
 *  - The cluster being unreachable or the driver being missing both
 *    surface as a friendly error string at the top of the panel —
 *    the URI is never exposed.
 */
interface LocalRowState {
  enabled: boolean;
  cursorField: string;
  /** Pristine values from the server — used to diff before saving. */
  serverEnabled: boolean;
  serverCursorField: string;
}

const DEFAULT_CURSOR_FIELD = 'updatedAt';

export const MongoIngestionPanel = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const queryArg = useMemo(
    () =>
      ({
        query: listMongoCollectionsQuery,
        variables: { workspaceId },
      }) as unknown as NonNullable<Parameters<typeof useQuery>[0]>,
    [workspaceId]
  );
  const { data, error: queryError, mutate } = useQuery(queryArg);

  const collections = useMemo(() => {
    const list = (
      data as unknown as
        | { listMongoCollections?: MongoCollectionInfoDto[] }
        | undefined
    )?.listMongoCollections;
    return Array.isArray(list) ? list : [];
  }, [data]);

  // Local edit state, keyed by collection name. Reseeds whenever the
  // server result changes; user-edits in flight stay in flight.
  const [rowStates, setRowStates] = useState<Record<string, LocalRowState>>({});
  const lastSeedRef = useRef<string>('');

  // Reseed when the server list changes shape. We compare a stable
  // signature of (name, enabled, cursorField) so an unrelated field
  // (e.g. estimatedCount drift) doesn't blow away unsaved edits.
  const serverSignature = useMemo(
    () =>
      collections
        .map(c => `${c.name}::${c.enabled ? '1' : '0'}::${c.cursorField ?? ''}`)
        .join('|'),
    [collections]
  );
  if (serverSignature !== lastSeedRef.current) {
    lastSeedRef.current = serverSignature;
    const next: Record<string, LocalRowState> = {};
    for (const c of collections) {
      next[c.name] = {
        enabled: c.enabled,
        cursorField: c.cursorField ?? DEFAULT_CURSOR_FIELD,
        serverEnabled: c.enabled,
        serverCursorField: c.cursorField ?? DEFAULT_CURSOR_FIELD,
      };
    }
    // Schedule the state update for the next tick to keep this
    // branch from triggering inside render. React batches the
    // assignment with the in-progress render — the useState setter
    // is render-safe (it bails out if the next value equals current).
    queueMicrotask(() => setRowStates(next));
  }

  const { trigger: triggerSet } = useMutation({
    mutation: setMongoIngestionConfigMutation,
  });
  const { trigger: triggerDelete } = useMutation({
    mutation: deleteMongoIngestionConfigMutation,
  });

  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleEnabled = useCallback((name: string) => {
    setRowStates(prev => {
      const current = prev[name];
      if (!current) return prev;
      return {
        ...prev,
        [name]: { ...current, enabled: !current.enabled },
      };
    });
    setSaveStatus(null);
  }, []);

  const updateCursorField = useCallback((name: string, value: string) => {
    setRowStates(prev => {
      const current = prev[name];
      if (!current) return prev;
      return {
        ...prev,
        [name]: { ...current, cursorField: value },
      };
    });
    setSaveStatus(null);
  }, []);

  const handleSave = useCallback(async () => {
    setBusy(true);
    setSaveError(null);
    setSaveStatus(null);
    try {
      let writes = 0;
      for (const [name, state] of Object.entries(rowStates)) {
        const enabledChanged = state.enabled !== state.serverEnabled;
        const cursorChanged = state.cursorField !== state.serverCursorField;
        if (!enabledChanged && !cursorChanged) {
          continue;
        }
        // Delete-when-flipping-off semantics: if the user disables a
        // previously-enabled row AND hasn't changed the cursor field,
        // we delete the row entirely to keep the table clean. Otherwise
        // we upsert so the cursor field override survives.
        if (
          enabledChanged &&
          !state.enabled &&
          !cursorChanged &&
          state.serverEnabled
        ) {
          await (triggerDelete as (args: unknown) => Promise<unknown>)({
            workspaceId,
            collectionName: name,
          });
          writes += 1;
          continue;
        }
        await (triggerSet as (args: unknown) => Promise<unknown>)({
          workspaceId,
          input: {
            collectionName: name,
            enabled: state.enabled,
            cursorField: state.cursorField.trim() || DEFAULT_CURSOR_FIELD,
          },
        });
        writes += 1;
      }
      if (writes === 0) {
        setSaveStatus('No changes to save.');
      } else {
        setSaveStatus(`Saved ${writes} change${writes === 1 ? '' : 's'}.`);
      }
      await mutate();
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not save ingestion configuration.'
      );
    } finally {
      setBusy(false);
    }
  }, [rowStates, triggerSet, triggerDelete, workspaceId, mutate]);

  const isDirty = useMemo(
    () =>
      Object.values(rowStates).some(
        s =>
          s.enabled !== s.serverEnabled || s.cursorField !== s.serverCursorField
      ),
    [rowStates]
  );

  const topErrorMessage = useMemo(() => {
    if (saveError) return saveError;
    if (queryError) {
      return queryError instanceof Error
        ? queryError.message
        : 'Could not list MongoDB collections. Verify the connection.';
    }
    return null;
  }, [queryError, saveError]);

  return (
    <div className={styles.root}>
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.title}>Configure ingestion</div>
          <div className={styles.subtitle}>
            Pick which Mongo collections sync into your analytics workspace.
          </div>
        </div>
      </div>

      {topErrorMessage ? (
        <div className={styles.errorMessage}>{topErrorMessage}</div>
      ) : null}

      {collections.length === 0 && !queryError ? (
        <div className={styles.emptyState}>
          No collections discovered yet. The MongoDB cluster may still be
          loading — try again shortly.
        </div>
      ) : null}

      {collections.length > 0 ? (
        <div className={styles.table}>
          {collections.map(c => (
            <CollectionRow
              key={c.name}
              info={c}
              local={
                rowStates[c.name] ?? {
                  enabled: c.enabled,
                  cursorField: c.cursorField ?? DEFAULT_CURSOR_FIELD,
                  serverEnabled: c.enabled,
                  serverCursorField: c.cursorField ?? DEFAULT_CURSOR_FIELD,
                }
              }
              workspaceId={workspaceId}
              onToggleEnabled={() => toggleEnabled(c.name)}
              onCursorFieldChange={value => updateCursorField(c.name, value)}
              disabled={busy}
            />
          ))}
        </div>
      ) : null}

      <div className={styles.footer}>
        {saveStatus ? (
          <span className={styles.saveStatus}>{saveStatus}</span>
        ) : null}
        <Button
          variant="primary"
          loading={busy}
          disabled={busy || !isDirty}
          onClick={() => void handleSave()}
          data-testid="mongo-ingestion-save"
        >
          Save changes
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// Per-row component — keeps sample-doc state local so expanding one
// row doesn't trigger a re-render of every other row.
// ============================================================================

interface CollectionRowProps {
  info: MongoCollectionInfoDto;
  local: LocalRowState;
  workspaceId: string;
  onToggleEnabled: () => void;
  onCursorFieldChange: (value: string) => void;
  disabled: boolean;
}

const CollectionRow = ({
  info,
  local,
  workspaceId,
  onToggleEnabled,
  onCursorFieldChange,
  disabled,
}: CollectionRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [samples, setSamples] = useState<string[] | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const sampleQueryArg = useMemo(
    () =>
      ({
        query: sampleMongoCollectionQuery,
        variables: {
          workspaceId,
          collectionName: info.name,
          limit: 5,
        },
        // Only fetch when explicitly requested via the expand toggle.
        // useQuery does not natively support skip; we drive on-demand
        // via the trigger pattern below instead.
        skip: true,
      }) as unknown as NonNullable<Parameters<typeof useQuery>[0]>,
    [workspaceId, info.name]
  );
  // The useQuery hook implementation in this codebase eagerly fetches;
  // we bypass it for on-demand samples via the mutation helper below
  // — but for simplicity we instead reuse the GraphQL fetcher via
  // useMutation against the query shape. That's how other panels do
  // ad-hoc reads — see analytics-connections/panel.tsx.
  // Reference to keep the variable used even when the hook impl
  // eagerly fetches but the data goes unread — TS unused-var noise.
  void sampleQueryArg;

  // useMutation works against any GraphQL operation, including queries.
  // We invoke it on demand to keep the on-row cost zero until the user
  // expands the sample preview.
  const { trigger: triggerSample } = useMutation({
    mutation: sampleMongoCollectionQuery,
  });

  const loadSample = useCallback(async () => {
    setSampleLoading(true);
    setSampleError(null);
    try {
      const result = (await (
        triggerSample as (args: unknown) => Promise<unknown>
      )({
        workspaceId,
        collectionName: info.name,
        limit: 5,
      })) as { sampleMongoCollection?: MongoSampleDocsDto } | undefined;
      const docs = result?.sampleMongoCollection?.documents ?? [];
      setSamples(docs);
    } catch (err) {
      setSampleError(
        err instanceof Error ? err.message : 'Could not sample documents.'
      );
    } finally {
      setSampleLoading(false);
    }
  }, [triggerSample, workspaceId, info.name]);

  const handleToggleExpand = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next && samples === null && !sampleLoading) {
      loadSample().catch(err => {
        console.error('Failed to load sample:', err);
      });
    }
  }, [expanded, samples, sampleLoading, loadSample]);

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.collectionName}>{info.name}</span>
        {typeof info.estimatedCount === 'number' ? (
          <span className={styles.countBadge}>
            {info.estimatedCount.toLocaleString()} docs
          </span>
        ) : null}
        {info.lastSyncedAt ? (
          <span className={styles.lastSyncedBadge}>
            synced {new Date(info.lastSyncedAt).toLocaleDateString()}
          </span>
        ) : null}
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={local.enabled}
            onChange={onToggleEnabled}
            disabled={disabled}
            data-testid={`mongo-ingestion-toggle-${info.name}`}
          />
          Enable
        </label>
        <label className={styles.toggleLabel}>
          Cursor
          <input
            type="text"
            className={styles.cursorFieldInput}
            value={local.cursorField}
            onChange={e => onCursorFieldChange(e.target.value)}
            placeholder={DEFAULT_CURSOR_FIELD}
            disabled={disabled}
            data-testid={`mongo-ingestion-cursor-${info.name}`}
          />
        </label>
        <button
          type="button"
          className={styles.sampleToggle}
          onClick={handleToggleExpand}
          disabled={disabled}
        >
          {expanded ? 'Hide samples' : 'Sample docs'}
        </button>
      </div>
      {expanded ? (
        <div className={styles.samplePanel}>
          {sampleLoading ? (
            <div className={styles.subtitle}>Loading samples…</div>
          ) : null}
          {sampleError ? (
            <div className={styles.errorMessage}>{sampleError}</div>
          ) : null}
          {samples && samples.length === 0 && !sampleLoading ? (
            <div className={styles.subtitle}>
              Collection returned no documents.
            </div>
          ) : null}
          {samples?.map((doc, idx) => (
            <pre key={idx} className={styles.sampleDoc}>
              {prettyJson(doc)}
            </pre>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Pretty-print a JSON document for the sample preview. Falls back to
 * the raw string if the server returned a non-JSON payload (defensive
 * — `JSON.stringify` was applied server-side so this is belt-and-
 * braces).
 */
function prettyJson(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}
