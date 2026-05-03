import { useQuery } from '@affine/admin/use-query';
import { useMutation } from '@affine/admin/use-mutation';
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
  const { data, mutate } = useQuery({
    query: adminVerifiedDocsQuery,
    variables: { workspaceId: workspaceIdFilter ?? null },
  });

  const docs: VerifiedDoc[] = (data?.adminVerifiedDocs ?? []) as VerifiedDoc[];

  return { docs, reload: mutate };
}

export function useUnverifyDoc() {
  const { trigger, isMutating } = useMutation({
    mutation: unverifyDocMutation,
  });

  const unverify = useCallback(
    async (workspaceId: string, docId: string) => {
      await trigger({ workspaceId, docId });
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

  const unverifySelected = useCallback(async () => {
    const toUnverify = docs.filter(d =>
      selected.has(`${d.workspaceId}:${d.docId}`)
    );
    await Promise.all(
      toUnverify.map(d => unverify(d.workspaceId, d.docId))
    );
    clearSelection();
    await reload();
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
