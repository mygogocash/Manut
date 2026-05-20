/**
 * Related Docs sidebar widget.
 *
 * Surfaces 3-5 semantically related docs for the currently-open doc.
 * Pipeline:
 *   1. Extract the current doc's markdown body (capped, with title
 *      fallback — same pattern as Auto Tag).
 *   2. Call `matchWorkspaceDocs` GraphQL surface (existing
 *      doc-semantic-search backend; pgvector-backed).
 *   3. Collapse chunks → per-doc candidates, drop the current doc.
 *   4. Render rows with a Link button that calls
 *      `DocsService.addLinkedDoc(currentDoc, relatedDoc)`.
 *
 * The optional LLM re-rank step (`Suggest Related Docs` prompt) is
 * intentionally NOT wired into the auto-load path — the vector
 * similarity score alone is usually enough, and the LLM round-trip
 * would add 2-3s of latency to a passive sidebar. The re-ranker is
 * available via `rankCandidatesWithLLM` for callers that want it.
 */

import { Button, Loading } from '@affine/component';
import { EventSourceService, GraphQLService } from '@affine/core/modules/cloud';
import { DocService, DocsService } from '@affine/core/modules/doc';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { matchWorkspaceDocsQuery } from '@affine/graphql';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';

import {
  collapseChunksToCandidates,
  type SemanticDocCandidate,
} from './related-docs-runner';
import * as styles from './related-docs-sidebar.css';

interface RelatedRow {
  candidate: SemanticDocCandidate;
  title: string;
  linked: boolean;
}

function formatScore(distance: number): string {
  if (!Number.isFinite(distance)) return '';
  // Distance is cosine distance (lower = closer). Display as a 0-100
  // similarity score so a layperson can read it.
  const sim = Math.max(0, Math.min(1, 1 - distance));
  return `${Math.round(sim * 100)}%`;
}

export const RelatedDocsSidebar = () => {
  const graphqlService = useService(GraphQLService);
  const docService = useService(DocService);
  const docsService = useService(DocsService);
  const workspaceService = useService(WorkspaceService);
  // useService(EventSourceService) is not used here (no SSE call), but
  // keeping the import shape consistent with auto-tag if we re-add an
  // LLM re-rank step later.
  void EventSourceService;

  const doc = docService.doc;
  const docId = doc.id;
  const workspaceId = workspaceService.workspace.id;
  const title = useLiveData(doc.title$);

  const [rows, setRows] = useState<RelatedRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Extract markdown body. Best-effort — fall back to title-only
      // so a missing-content path doesn't break the sidebar.
      let bodyMarkdown = '';
      try {
        const store = doc.blockSuiteDoc.getStore();
        if (store) {
          const transformer = store.getTransformer();
          const { MarkdownAdapter } =
            await import('@blocksuite/affine/shared/adapters');
          const adapter = new MarkdownAdapter(transformer, store.provider);
          const extracted = await adapter.fromDoc(store);
          bodyMarkdown = extracted?.file ?? '';
        }
      } catch (err) {
        console.warn('Related Docs: markdown extraction failed', err);
      }

      const content = (bodyMarkdown || title || 'Untitled').slice(0, 3000);
      if (content.length < 50) {
        setRows([]);
        return;
      }

      const res = await graphqlService.gql({
        query: matchWorkspaceDocsQuery,
        variables: {
          workspaceId,
          content,
          limit: 15,
          threshold: 0.7,
        },
      });

      const chunks =
        res.currentUser?.copilot?.contexts?.[0]?.matchWorkspaceDocs ?? [];

      const candidates = collapseChunksToCandidates(
        chunks.map(c => ({
          docId: c.docId,
          chunk: c.chunk,
          content: c.content,
          distance: c.distance,
        })),
        new Set([docId])
      ).slice(0, 5);

      const titlesByDoc = new Map<string, string>();
      for (const cand of candidates) {
        const rec = docsService.list.doc$(cand.docId).value;
        titlesByDoc.set(cand.docId, rec?.title$.value || 'Untitled');
      }

      // Note: `linked` is computed in render below from the current
      // `linkedIds` set, not snapshotted here — so we keep `load` stable
      // (re-creating it on every link click would loop with useEffect).
      setRows(
        candidates.map(c => ({
          candidate: c,
          title: titlesByDoc.get(c.docId) ?? 'Untitled',
          linked: false,
        }))
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to load related docs.';
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [doc, docId, docsService, graphqlService, title, workspaceId]);

  useEffect(() => {
    load().catch(err => {
      // load() catches its own runtime errors and routes them to the
      // `error` state; this is a belt-and-braces guard for synchronous
      // throws (e.g. service-not-available at construction time).
      console.warn('Related Docs: load threw', err);
    });
  }, [load]);

  const onLink = useCallback(
    async (relatedDocId: string) => {
      try {
        await docsService.addLinkedDoc(docId, relatedDocId);
        setLinkedIds(prev => {
          const next = new Set(prev);
          next.add(relatedDocId);
          return next;
        });
        setRows(prev =>
          prev
            ? prev.map(r =>
                r.candidate.docId === relatedDocId ? { ...r, linked: true } : r
              )
            : prev
        );
      } catch (err) {
        console.error('Related Docs: link failed', err);
      }
    },
    [docId, docsService]
  );

  return (
    <div className={styles.root}>
      <div className={styles.heading}>Related</div>
      {loading && !rows && <Loading />}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && rows && rows.length === 0 && (
        <div className={styles.empty}>
          No related docs found. Try adding more content to this doc.
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className={styles.list}>
          {rows.map(row => {
            const isLinked = linkedIds.has(row.candidate.docId);
            return (
              <div className={styles.row} key={row.candidate.docId}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{row.title}</div>
                </div>
                <div className={styles.rowScore}>
                  {formatScore(row.candidate.distance)}
                </div>
                <Button
                  variant="plain"
                  size="default"
                  className={styles.rowLinkBtn}
                  onClick={() => {
                    onLink(row.candidate.docId).catch(err => {
                      console.warn('Related Docs: link threw', err);
                    });
                  }}
                  disabled={isLinked}
                  data-testid="related-docs-link-btn"
                >
                  {isLinked ? 'Linked' : 'Link'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
