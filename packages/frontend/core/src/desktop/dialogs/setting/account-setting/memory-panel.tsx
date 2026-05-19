import { Button, IconButton, notify, Tooltip } from '@affine/component';
import { SettingRow } from '@affine/component/setting-components';
import { GraphQLService } from '@affine/core/modules/cloud';
import { WorkspaceService } from '@affine/core/modules/workspace';
import {
  forgetMemoryMutation,
  type ForgetMemoryMutationVariables,
  type MemoryEntity,
  type MyMemoriesQuery,
  myMemoriesQuery,
  type MyMemoriesQueryVariables,
  pinMemoryMutation,
  type PinMemoryMutationVariables,
  promoteMemoryToWorkspaceMutation,
  type PromoteMemoryToWorkspaceMutationVariables,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  ArrowUpBigIcon,
  DeleteIcon,
  PinedIcon,
  PinIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';

import * as styles from './memory-panel.css';

/**
 * Manut Wave 5 (M2 — E2.2) — "What AI knows about me".
 *
 * Lists the memories the AI has ingested for the current workspace +
 * user, grouped by scope. Lets the user:
 *   - pin / unpin a memory (surface ahead of unpinned ones at recall).
 *   - forget a memory (hard delete).
 *   - promote a personal (user-scope) memory to workspace-scope so
 *     every member of the workspace can recall it.
 *
 * Implementation notes:
 *   - Talks to the GraphQL surface in
 *     `plugins/copilot/memory/memory.resolver.ts` via `GraphQLService.gql`
 *     wrapped in a thin `useSWR`. Bypasses `useQuery`/`useMutation`
 *     because the response/variables types live in our manual stand-in
 *     module (`@affine/graphql`'s `memory.ts`) until codegen rebuilds
 *     the `Queries`/`Mutations` unions in `schema.ts`. Once codegen
 *     runs we can collapse to the standard wrappers — the runtime
 *     behaviour is identical.
 *   - Best-effort error handling: a failure surfaces a toast and the
 *     query is revalidated by the next focus / explicit `mutate()`.
 *   - We don't optimistic-update locally — the server is the source of
 *     truth for `pinned` and `scope` transitions.
 */

const MAX_CONTENT_CHARS = 120;

/** Truncate a memory's content to a stable preview length. */
function truncate(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) {
    return content;
  }
  return `${content.slice(0, MAX_CONTENT_CHARS - 1).trimEnd()}…`;
}

/** Format an ISO timestamp into a "5 May 2026" short form. */
function formatTimestamp(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

type MemoryAction = (memory: MemoryEntity) => void;

interface MemoryRowProps {
  memory: MemoryEntity;
  busy: boolean;
  locale: string;
  onPin: MemoryAction;
  onForget: MemoryAction;
  onPromote: MemoryAction;
}

function MemoryRowItem({
  memory,
  busy,
  locale,
  onPin,
  onForget,
  onPromote,
}: MemoryRowProps) {
  const t = useI18n();
  const handlePin = useCallback(() => {
    onPin(memory);
  }, [memory, onPin]);
  const handleForget = useCallback(() => {
    onForget(memory);
  }, [memory, onForget]);
  const handlePromote = useCallback(() => {
    onPromote(memory);
  }, [memory, onPromote]);

  const timestamp = formatTimestamp(memory.createdAt, locale);
  const canPromote = memory.scope === 'user';

  return (
    <div
      className={styles.memoryRow}
      data-pinned={memory.pinned ? 'true' : 'false'}
      data-testid="memory-row"
      data-memory-id={memory.id}
    >
      <div className={styles.memoryMain}>
        <div className={styles.memoryMeta}>
          <span className={styles.kindBadge} data-kind={memory.kind}>
            {memory.kind}
          </span>
          <span className={styles.scopeBadge}>
            {memory.scope === 'user'
              ? (t['com.affine.settings.account.memory.scope.user']?.() ??
                'Personal')
              : (t['com.affine.settings.account.memory.scope.workspace']?.() ??
                'Workspace')}
          </span>
          {memory.pinned ? (
            <span className={styles.pinnedDot}>
              {t['com.affine.settings.account.memory.pinned']?.() ?? 'Pinned'}
            </span>
          ) : null}
          {timestamp ? (
            <span className={styles.memoryTimestamp}>{timestamp}</span>
          ) : null}
        </div>
        <div className={styles.memoryContent}>{truncate(memory.content)}</div>
      </div>
      <div className={styles.memoryActions}>
        <Tooltip
          content={
            memory.pinned
              ? (t['com.affine.settings.account.memory.action.unpin']?.() ??
                'Unpin')
              : (t['com.affine.settings.account.memory.action.pin']?.() ??
                'Pin')
          }
        >
          <IconButton
            data-testid="memory-pin"
            size={20}
            onClick={handlePin}
            disabled={busy}
          >
            {memory.pinned ? <PinedIcon /> : <PinIcon />}
          </IconButton>
        </Tooltip>
        {canPromote ? (
          <Tooltip
            content={
              t['com.affine.settings.account.memory.action.promote']?.() ??
              'Promote to workspace'
            }
          >
            <IconButton
              data-testid="memory-promote"
              size={20}
              onClick={handlePromote}
              disabled={busy}
            >
              <ArrowUpBigIcon />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip
          content={
            t['com.affine.settings.account.memory.action.forget']?.() ??
            'Forget'
          }
        >
          <IconButton
            data-testid="memory-forget"
            size={20}
            onClick={handleForget}
            disabled={busy}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}

export interface MemoryPanelProps {
  /**
   * Reserved for future cross-tab deep links (mirrors the other
   * account-setting panels). Unused today.
   */
  onChangeSettingState?: () => void;
}

export function MemoryPanel(_props: MemoryPanelProps) {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const workspace = workspaceService.workspace;
  const workspaceId = workspace.id;
  const isLocal = workspace.flavour === 'local';
  const locale =
    typeof navigator !== 'undefined' && navigator.language
      ? navigator.language
      : 'en';

  const gqlService = useService(GraphQLService);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const swrKey = useMemo<readonly [string, string] | null>(
    () => (isLocal ? null : (['manut-memories', workspaceId] as const)),
    [isLocal, workspaceId]
  );

  const {
    data,
    isLoading,
    error,
    mutate: mutateMemories,
  } = useSWR<MyMemoriesQuery, Error>(
    swrKey,
    async () => {
      const vars: MyMemoriesQueryVariables = { workspaceId };
      const response = await gqlService.gql({
        query: myMemoriesQuery,
        variables: vars,
      } as never);
      return response as unknown as MyMemoriesQuery;
    },
    {
      revalidateOnFocus: false,
      onError: (loadError: Error) => {
        notify.error({
          title:
            t['com.affine.settings.account.memory.load-error']?.() ??
            'Failed to load AI memories',
          message: String(loadError) || undefined,
        });
      },
    }
  );

  // Memoize the empty-fallback so the `grouped` useMemo below doesn't
  // re-run on every render — React 19's exhaustive-deps lint flags
  // `data?.myMemories ?? []` because the empty literal is a fresh
  // array each render. See CLAUDE.md "preserve-manual-memoization".
  const memories: MemoryEntity[] = useMemo(
    () => data?.myMemories ?? [],
    [data]
  );

  const handlePin: MemoryAction = useCallback(
    memory => {
      const run = async () => {
        setPendingId(memory.id);
        try {
          const vars: PinMemoryMutationVariables = { id: memory.id };
          await gqlService.gql({
            query: pinMemoryMutation,
            variables: vars,
          } as never);
          await mutateMemories();
        } catch (e) {
          notify.error({
            title:
              t['com.affine.settings.account.memory.pin-error']?.() ??
              'Failed to update memory',
            message: String(e) || undefined,
          });
        } finally {
          setPendingId(null);
        }
      };
      run().catch(() => {
        // run() handles its own errors via notify(); this catch is
        // just to satisfy the no-floating-promises lint rule.
      });
    },
    [gqlService, mutateMemories, t]
  );

  const handleForget: MemoryAction = useCallback(
    memory => {
      const run = async () => {
        setPendingId(memory.id);
        try {
          const vars: ForgetMemoryMutationVariables = { id: memory.id };
          await gqlService.gql({
            query: forgetMemoryMutation,
            variables: vars,
          } as never);
          await mutateMemories();
          notify.success({
            title:
              t['com.affine.settings.account.memory.forget-success']?.() ??
              'Memory forgotten',
          });
        } catch (e) {
          notify.error({
            title:
              t['com.affine.settings.account.memory.forget-error']?.() ??
              'Failed to forget memory',
            message: String(e) || undefined,
          });
        } finally {
          setPendingId(null);
        }
      };
      run().catch(() => {
        // run() handles its own errors via notify(); this catch is
        // just to satisfy the no-floating-promises lint rule.
      });
    },
    [gqlService, mutateMemories, t]
  );

  const handlePromote: MemoryAction = useCallback(
    memory => {
      const run = async () => {
        setPendingId(memory.id);
        try {
          const vars: PromoteMemoryToWorkspaceMutationVariables = {
            id: memory.id,
          };
          await gqlService.gql({
            query: promoteMemoryToWorkspaceMutation,
            variables: vars,
          } as never);
          await mutateMemories();
          notify.success({
            title:
              t['com.affine.settings.account.memory.promote-success']?.() ??
              'Promoted to workspace',
          });
        } catch (e) {
          notify.error({
            title:
              t['com.affine.settings.account.memory.promote-error']?.() ??
              'Failed to promote memory',
            message: String(e) || undefined,
          });
        } finally {
          setPendingId(null);
        }
      };
      run().catch(() => {
        // run() handles its own errors via notify(); this catch is
        // just to satisfy the no-floating-promises lint rule.
      });
    },
    [gqlService, mutateMemories, t]
  );

  const grouped = useMemo(() => {
    const userMems: MemoryEntity[] = [];
    const workspaceMems: MemoryEntity[] = [];
    for (const memory of memories) {
      if (memory.scope === 'user') {
        userMems.push(memory);
      } else {
        workspaceMems.push(memory);
      }
    }
    return { userMems, workspaceMems };
  }, [memories]);

  if (isLocal) {
    return null;
  }

  return (
    <SettingRow
      name={
        t['com.affine.settings.account.memory.title']?.() ??
        'What the AI knows about you'
      }
      desc={
        t['com.affine.settings.account.memory.subtitle']?.() ??
        'Review, pin, or forget the memories the AI uses to personalise replies.'
      }
      spreadCol={false}
      data-testid="memory-panel-row"
    >
      <div className={styles.panel} data-testid="memory-panel">
        {isLoading ? (
          <div className={styles.loading} data-testid="memory-loading">
            {t['com.affine.settings.account.memory.loading']?.() ??
              'Loading memories…'}
          </div>
        ) : error ? (
          <div className={styles.errorState} data-testid="memory-error">
            <strong>
              {t['com.affine.settings.account.memory.load-error']?.() ??
                'Failed to load AI memories'}
            </strong>
            <Button
              onClick={() => {
                mutateMemories().catch(() => {
                  // SWR surfaces the error via onError; nothing to
                  // do here beyond clearing the floating promise.
                });
              }}
              style={{ alignSelf: 'flex-start' }}
            >
              {t['com.affine.settings.account.memory.retry']?.() ?? 'Retry'}
            </Button>
          </div>
        ) : memories.length === 0 ? (
          <div className={styles.emptyState} data-testid="memory-empty">
            <span>
              {t['com.affine.settings.account.memory.empty.title']?.() ??
                'No memories yet'}
            </span>
            <span className={styles.panelSubtitle}>
              {t['com.affine.settings.account.memory.empty.body']?.() ??
                'The AI starts learning after a few chats.'}
            </span>
          </div>
        ) : (
          <>
            <MemorySection
              title={
                t['com.affine.settings.account.memory.section.user']?.() ??
                'Personal memories'
              }
              memories={grouped.userMems}
              pendingId={pendingId}
              locale={locale}
              onPin={handlePin}
              onForget={handleForget}
              onPromote={handlePromote}
            />
            <MemorySection
              title={
                t['com.affine.settings.account.memory.section.workspace']?.() ??
                'Workspace memories'
              }
              memories={grouped.workspaceMems}
              pendingId={pendingId}
              locale={locale}
              onPin={handlePin}
              onForget={handleForget}
              onPromote={handlePromote}
            />
          </>
        )}
      </div>
    </SettingRow>
  );
}

interface MemorySectionProps {
  title: string;
  memories: MemoryEntity[];
  pendingId: string | null;
  locale: string;
  onPin: MemoryAction;
  onForget: MemoryAction;
  onPromote: MemoryAction;
}

function MemorySection({
  title,
  memories,
  pendingId,
  locale,
  onPin,
  onForget,
  onPromote,
}: MemorySectionProps) {
  if (memories.length === 0) {
    return null;
  }
  return (
    <div className={styles.sectionGroup}>
      <div className={styles.sectionHeader}>
        <span>{title}</span>
        <span className={styles.sectionCount}>({memories.length})</span>
      </div>
      <div className={styles.memoryList}>
        {memories.map(memory => (
          <MemoryRowItem
            key={memory.id}
            memory={memory}
            busy={pendingId === memory.id}
            locale={locale}
            onPin={onPin}
            onForget={onForget}
            onPromote={onPromote}
          />
        ))}
      </div>
    </div>
  );
}
