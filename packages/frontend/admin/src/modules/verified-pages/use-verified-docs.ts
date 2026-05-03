import { useMutation } from '@affine/admin/use-mutation';
import { useQuery } from '@affine/admin/use-query';
import { adminVerifiedDocsQuery, unverifyDocMutation } from '@affine/graphql';
import { useCallback, useState } from 'react';

export interface VerifiedDoc {
  workspaceId: string;
  docId: string;
  verifiedAt: Date;
  verifiedBy: string | null;
  verificationExpiresAt: Date | null;
}

export function useVerifiedDocs(workspaceIdFilter?: string) {
  // adminVerifiedDocsQuery's variables aren't part of the codegen'd
  // discriminated union yet, so the framework infers `variables: undefined`.
  // Cast at the boundary; remove once codegen runs against the new schema.
  const queryArg = {
    query: adminVerifiedDocsQuery,
    variables: { workspaceId: workspaceIdFilter ?? null },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, mutate } = useQuery(queryArg);

  const docs: VerifiedDoc[] = (
    (data as unknown as { adminVerifiedDocs?: VerifiedDoc[] } | undefined)
      ?.adminVerifiedDocs ?? []
  ) as VerifiedDoc[];

  return { docs, reload: mutate };
}

export function useUnverifyDoc() {
  const { trigger, isMutating } = useMutation({
    mutation: unverifyDocMutation,
  });

  const unverify = useCallback(
    async (workspaceId: string, docId: string) => {
      await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        docId,
      });
    },
    [trigger]
  );

  return { unverify, isMutating };
}

export function useVerifiedDocsWithActions(workspaceIdFilter?: string) {
  const { docs, reload } = useVerifiedDocs(workspaceIdFilter);
  const { unverify, isMutating } = useUnverifyDoc();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(
    (keys: string[]) => {
      setSelected(new Set(keys));
    },
    []
  );

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  /**
   * Returns the number of docs that were unverified. The caller should use
   * this — not `selected.size` after the call — because the selection state
   * is cleared before `reload()` resolves.
   */
  const unverifySelected = useCallback(async (): Promise<number> => {
    const toUnverify = docs.filter(d =>
      selected.has(`${d.workspaceId}:${d.docId}`)
    );
    const count = toUnverify.length;
    await Promise.all(
      toUnverify.map(d => unverify(d.workspaceId, d.docId))
    );
    clearSelection();
    await reload();
    return count;
  }, [docs, selected, unverify, clearSelection, reload]);

  const unverifyOne = useCallback(
    async (workspaceId: string, docId: string) => {
      await unverify(workspaceId, docId);
      await reload();
    },
    [unverify, reload]
  );

  return {
    docs,
    selected,
    toggleSelect,
    selectAll,
    clearSelection,
    unverifySelected,
    unverifyOne,
    isMutating,
    reload,
  };
}
