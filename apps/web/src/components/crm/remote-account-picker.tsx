"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useDebounce } from "@/hooks/use-debounce";
import { ApiError } from "@/lib/api-client";
import { getAccount, listAccounts } from "@/services/crm-account.service";

// Server-backed account picker. Debounced input hits
// /accounts?search=…&limit=20; subsequent pages append on scroll-to-
// bottom inside the dropdown so reps can find rows past the first 20
// without leaving the picker.
const PICKER_LIMIT = 20;
// Trigger the next page when the scroll container is within this many
// pixels of the bottom. Keeps loads ahead of the cursor.
const SCROLL_THRESHOLD_PX = 80;

export interface RemoteAccountPickerOption {
  id: string;
  name: string;
  domain: string | null;
}

interface RemoteAccountPickerProps {
  value: string;
  onValueChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialOption?: RemoteAccountPickerOption | null;
  "aria-invalid"?: boolean;
}

export function RemoteAccountPicker({
  value,
  onValueChange,
  disabled,
  placeholder = "Search accounts…",
  initialOption,
  ...rest
}: RemoteAccountPickerProps) {
  const [inputValue, setInputValue] = useState(initialOption?.name ?? "");
  const debouncedQuery = useDebounce(inputValue, 300);
  const [items, setItems] = useState<RemoteAccountPickerOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<RemoteAccountPickerOption | null>(
    initialOption ?? null,
  );
  const hydratedFor = useRef<string | null>(initialOption?.id ?? null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      hydratedFor.current = null;
      return;
    }
    if (value === hydratedFor.current || selected?.id === value) return;

    let cancelled = false;
    getAccount(value)
      .then((res) => {
        if (cancelled) return;
        const opt = {
          id: res.data.id,
          name: res.data.name,
          domain: res.data.domain,
        };
        setSelected(opt);
        setInputValue(opt.name);
        hydratedFor.current = value;
      })
      .catch(() => {
        // Selected id could not be resolved — leave selected null.
      });
    return () => {
      cancelled = true;
    };
  }, [value, selected]);

  // Reset to page 1 whenever the debounced query changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    listAccounts({
      page: 1,
      limit: PICKER_LIMIT,
      search: debouncedQuery || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(
          res.data.map((a) => ({
            id: a.id,
            name: a.name,
            domain: a.domain,
          })),
        );
        setTotal(res.meta.total);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await listAccounts({
        page: next,
        limit: PICKER_LIMIT,
        search: debouncedQuery || undefined,
      });
      setItems((prev) => [
        ...prev,
        ...res.data.map((a) => ({
          id: a.id,
          name: a.name,
          domain: a.domain,
        })),
      ]);
      setTotal(res.meta.total);
      setPage(next);
    } catch {
      // Silent fail — user can re-trigger by scrolling again.
    } finally {
      setLoadingMore(false);
    }
  }, [debouncedQuery, hasMore, loading, loadingMore, page]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const target = e.currentTarget;
    if (
      target.scrollHeight - target.scrollTop - target.clientHeight <
      SCROLL_THRESHOLD_PX
    ) {
      void loadMore();
    }
  }

  const renderedItems = (() => {
    if (!selected) return items;
    if (items.some((i) => i.id === selected.id)) return items;
    return [selected, ...items];
  })();

  return (
    <Combobox<string>
      items={renderedItems.map((i) => i.id)}
      filter={null}
      value={value || null}
      onValueChange={(v) => {
        const next = v ?? "";
        onValueChange(next);
        if (!next) {
          setSelected(null);
          setInputValue("");
        }
      }}
      inputValue={inputValue}
      onInputValueChange={(v) => setInputValue(v)}
      disabled={disabled}
    >
      <ComboboxInput placeholder={placeholder} showClear={!!value} {...rest} />
      <ComboboxContent>
        <ComboboxList onScroll={handleScroll}>
          {loading ? (
            <div
              className={`
                text-muted-foreground flex items-center justify-center gap-2
                py-3 text-xs
              `}
            >
              <Loader2 className="size-3 animate-spin" />
              Searching…
            </div>
          ) : null}
          {renderedItems.map((item) => (
            <ComboboxItem
              key={item.id}
              value={item.id}
              onClick={() => {
                setSelected(item);
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{item.name}</span>
                {item.domain ? (
                  <span className="text-muted-foreground text-[11px]">
                    {item.domain}
                  </span>
                ) : null}
              </div>
            </ComboboxItem>
          ))}
          {loadingMore ? (
            <div
              className={`
                text-muted-foreground flex items-center justify-center gap-2
                py-2 text-xs
              `}
            >
              <Loader2 className="size-3 animate-spin" />
              Loading more…
            </div>
          ) : null}
          {!loading && !loadingMore && hasMore ? (
            <div className="text-muted-foreground py-1 text-center text-[11px]">
              {total - items.length} more — scroll to load
            </div>
          ) : null}
        </ComboboxList>
        <ComboboxEmpty>No accounts match.</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
