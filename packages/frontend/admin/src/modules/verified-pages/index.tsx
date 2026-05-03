import { Button } from '@affine/admin/components/ui/button';
import { Checkbox } from '@affine/admin/components/ui/checkbox';
import { Input } from '@affine/admin/components/ui/input';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Header } from '../header';
import { useVerifiedDocsWithActions } from './use-verified-docs';

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function VerifiedPagesContent() {
  const [workspaceFilter, setWorkspaceFilter] = useState('');
  const activeWorkspaceFilter = workspaceFilter.trim() || undefined;

  const {
    docs,
    selected,
    toggleSelect,
    selectAll,
    clearSelection,
    unverifySelected,
    unverifyOne,
    isMutating,
  } = useVerifiedDocsWithActions(activeWorkspaceFilter);

  const allKeys = useMemo(
    () => docs.map(d => `${d.workspaceId}:${d.docId}`),
    [docs]
  );

  const allSelected = docs.length > 0 && selected.size === docs.length;
  const someSelected = selected.size > 0 && !allSelected;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(allKeys);
    }
  }, [allSelected, clearSelection, selectAll, allKeys]);

  const handleUnverifySelected = useCallback(async () => {
    try {
      // Use the returned count — `selected.size` is stale after the call
      // because `unverifySelected` clears the selection before resolving.
      const count = await unverifySelected();
      toast.success(`Unverified ${count} doc(s).`);
    } catch {
      toast.error('Failed to unverify some docs. Please try again.');
    }
  }, [unverifySelected]);

  return (
    <div className="h-dvh flex-1 flex-col flex">
      <Header
        title="Verified Pages"
        endFix={
          selected.size > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={isMutating}
              onClick={() => {
                handleUnverifySelected().catch(console.error);
              }}
            >
              Unverify {selected.size} selected
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-3 px-6 py-3 border-b border-border/60">
        <Input
          className="max-w-xs h-8 text-sm"
          placeholder="Filter by workspace ID…"
          value={workspaceFilter}
          onChange={e => setWorkspaceFilter(e.target.value)}
        />
        {workspaceFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWorkspaceFilter('')}
          >
            Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {docs.length} verified page{docs.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b border-border/60">
            <tr>
              <th className="w-10 px-4 py-2 text-left">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Doc ID
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Workspace ID
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Verified By
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Verified At
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Expires At
              </th>
              <th className="w-24 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No verified pages found.
                </td>
              </tr>
            ) : (
              docs.map(doc => {
                const key = `${doc.workspaceId}:${doc.docId}`;
                const isSelected = selected.has(key);
                return (
                  <VerifiedDocRow
                    key={key}
                    doc={doc}
                    isSelected={isSelected}
                    onToggle={() => toggleSelect(key)}
                    onUnverify={async () => {
                      try {
                        await unverifyOne(doc.workspaceId, doc.docId);
                        toast.success('Page unverified.');
                      } catch {
                        toast.error('Failed to unverify.');
                      }
                    }}
                    isMutating={isMutating}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface VerifiedDocRowProps {
  doc: {
    workspaceId: string;
    docId: string;
    verifiedAt: Date;
    verifiedBy: string | null;
    verificationExpiresAt: Date | null;
  };
  isSelected: boolean;
  onToggle: () => void;
  onUnverify: () => Promise<void>;
  isMutating: boolean;
}

function VerifiedDocRow({
  doc,
  isSelected,
  onToggle,
  onUnverify,
  isMutating,
}: VerifiedDocRowProps) {
  const isExpired =
    doc.verificationExpiresAt != null &&
    new Date(doc.verificationExpiresAt) <= new Date();

  return (
    <tr
      className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${
        isSelected ? 'bg-muted/50' : ''
      }`}
    >
      <td className="px-4 py-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          aria-label={`Select ${doc.docId}`}
        />
      </td>
      <td className="px-4 py-2 font-mono text-xs text-foreground/80">
        {doc.docId}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-foreground/60">
        {doc.workspaceId}
      </td>
      <td className="px-4 py-2 text-xs text-foreground/80">
        {doc.verifiedBy ?? '—'}
      </td>
      <td className="px-4 py-2 text-xs">{formatDate(doc.verifiedAt)}</td>
      <td className="px-4 py-2 text-xs">
        {doc.verificationExpiresAt ? (
          <span className={isExpired ? 'text-destructive' : ''}>
            {formatDate(doc.verificationExpiresAt)}
            {isExpired ? ' (expired)' : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">Never</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <Button
          variant="ghost"
          size="sm"
          disabled={isMutating}
          onClick={() => {
            onUnverify().catch(console.error);
          }}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
        >
          Unverify
        </Button>
      </td>
    </tr>
  );
}

export function VerifiedPagesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh flex-1 flex-col flex">
          <Header title="Verified Pages" />
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        </div>
      }
    >
      <VerifiedPagesContent />
    </Suspense>
  );
}

export { VerifiedPagesPage as Component };
