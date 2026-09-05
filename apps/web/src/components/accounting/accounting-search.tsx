"use client";

import {
  BookOpen,
  FileText,
  Hash,
  Landmark,
  Loader2,
  Search,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { ApiError } from "@/lib/api-client";
import {
  type AccountingSearchResults,
  invoicePrintPath,
  searchAccounting,
} from "@/services/accounting.service";

interface AccountingSearchProps {
  /** Switch the accounting tab (the page's setActiveTab) for a result click. */
  onNavigate: (tabId: string) => void;
}

export function AccountingSearch({ onNavigate }: AccountingSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountingSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    // Abort a superseded request on the wire (not just ignore its result), so a
    // fast typist doesn't leave prior queries running server-side. The signal
    // also disambiguates a real error from a cancellation in the catch.
    const controller = new AbortController();
    setLoading(true);
    searchAccounting({ q: term }, controller.signal)
      .then((res) => {
        setResults(res.data);
        // Don't reopen the panel if the user has already moved on (clicked a
        // result → focus is on that button, or blurred the field).
        if (document.activeElement === inputRef.current) setOpen(true);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResults(null);
        toast.error(err instanceof ApiError ? err.message : "Search failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced]);

  const showPanel = open && query.trim().length >= 2;
  const total = results?.total ?? 0;

  const openInvoice = (id: string) => {
    window.open(invoicePrintPath(id), "_blank");
    setOpen(false);
  };
  const goTab = (tabId: string) => {
    onNavigate(tabId);
    setOpen(false);
  };

  return (
    <Popover open={showPanel} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-xl">
          <Search
            className={`
              text-muted-foreground pointer-events-none absolute top-1/2 left-3
              size-4 -translate-y-1/2
            `}
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results && total > 0) setOpen(true);
            }}
            placeholder="Search invoices, bills, journals, accounts, bank lines…"
            className="pl-9"
            aria-label="Search accounting"
          />
          {loading ? (
            <Loader2
              className={`
                text-muted-foreground absolute top-1/2 right-3 size-4
                -translate-y-1/2 animate-spin
              `}
            />
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[70vh] w-[560px] max-w-[92vw] overflow-auto p-0"
      >
        {total === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-xs">
            {loading ? "Searching…" : `No matches for “${query.trim()}”`}
          </p>
        ) : (
          <div className="py-1">
            <Group
              icon={FileText}
              label="Invoices & bills"
              items={results?.results.invoices ?? []}
              render={(i) => (
                <ResultRow
                  key={i.id}
                  onClick={() => openInvoice(i.id)}
                  primary={i.invoiceNo}
                  secondary={i.counterparty}
                  right={
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">
                        {formatCurrency(i.amount)} {i.currency}
                      </span>
                      <Badge status={i.status}>{i.status}</Badge>
                    </span>
                  }
                  tag={
                    <Badge variant={i.type === "receivable" ? "blue" : "amber"}>
                      {i.type}
                    </Badge>
                  }
                />
              )}
            />
            <Group
              icon={Wallet}
              label="Payments"
              items={results?.results.payments ?? []}
              render={(p) => (
                <ResultRow
                  key={p.id}
                  onClick={() => openInvoice(p.invoiceId)}
                  primary={`${p.invoiceNo} · ${p.counterparty}`}
                  secondary={`${p.method} · ${formatDate(p.date)}`}
                  right={
                    <span className="tabular-nums">
                      {formatCurrency(p.amount)}
                    </span>
                  }
                />
              )}
            />
            <Group
              icon={BookOpen}
              label="Journal entries"
              items={results?.results.journals ?? []}
              render={(j) => (
                <ResultRow
                  key={j.id}
                  onClick={() => goTab("journals")}
                  primary={j.reference || "(no reference)"}
                  secondary={j.description || formatDate(j.date)}
                  right={<Badge status={j.status}>{j.status}</Badge>}
                />
              )}
            />
            <Group
              icon={Hash}
              label="Chart of accounts"
              items={results?.results.accounts ?? []}
              render={(a) => (
                <ResultRow
                  key={a.id}
                  onClick={() => goTab("coa")}
                  primary={`${a.code} — ${a.name}`}
                  secondary={a.type}
                />
              )}
            />
            <Group
              icon={Landmark}
              label="Bank lines"
              items={results?.results.bank ?? []}
              render={(b) => (
                <ResultRow
                  key={b.id}
                  onClick={() => goTab("bank")}
                  primary={b.description}
                  secondary={`${b.entityName} · ${formatDate(b.date)}`}
                  right={
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">
                        {formatCurrency(b.amount)}
                      </span>
                      <Badge status={b.status}>{b.status}</Badge>
                    </span>
                  }
                />
              )}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Group<T>({
  icon: Icon,
  label,
  items,
  render,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={`
        border-border border-b py-1
        last:border-b-0
      `}
    >
      <div
        className={`
          text-muted-foreground flex items-center gap-1.5 px-3 py-1.5
          text-[10px] font-semibold tracking-wider uppercase
        `}
      >
        <Icon className="size-3" />
        {label}
      </div>
      {items.map(render)}
    </div>
  );
}

function ResultRow({
  onClick,
  primary,
  secondary,
  right,
  tag,
}: {
  onClick: () => void;
  primary: string;
  secondary?: string;
  right?: React.ReactNode;
  tag?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        hover:bg-muted
        flex w-full items-center gap-2 px-3 py-2 text-left text-xs
      `}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{primary}</span>
          {tag}
        </span>
        {secondary ? (
          <span className="text-muted-foreground block truncate">
            {secondary}
          </span>
        ) : null}
      </span>
      {right ? (
        <span className="text-muted-foreground shrink-0 text-right">
          {right}
        </span>
      ) : null}
    </button>
  );
}
