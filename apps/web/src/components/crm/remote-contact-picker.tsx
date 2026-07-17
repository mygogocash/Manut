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
import { getContact, listContacts } from "@/services/crm-contact.service";

// Server-backed contact picker scoped to a single account. Mirrors
// RemoteAccountPicker including infinite scroll on the popup.
const PICKER_LIMIT = 20;
const SCROLL_THRESHOLD_PX = 80;

export interface RemoteContactPickerOption {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
}

function labelFor(opt: RemoteContactPickerOption): string {
  const name = `${opt.firstName} ${opt.lastName}`.trim();
  return opt.title ? `${name} · ${opt.title}` : name;
}

interface RemoteContactPickerProps {
  value: string;
  onValueChange: (id: string) => void;
  accountId: string;
  disabled?: boolean;
  placeholder?: string;
  initialOption?: RemoteContactPickerOption | null;
}

export function RemoteContactPicker({
  value,
  onValueChange,
  accountId,
  disabled,
  placeholder = "Search contacts…",
  initialOption,
}: RemoteContactPickerProps) {
  const [inputValue, setInputValue] = useState(
    initialOption ? labelFor(initialOption) : "",
  );
  const debouncedQuery = useDebounce(inputValue, 300);
  const [items, setItems] = useState<RemoteContactPickerOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<RemoteContactPickerOption | null>(
    initialOption ?? null,
  );
  const hydratedFor = useRef<string | null>(initialOption?.id ?? null);

  // Reset state when the account scope changes.
  const lastAccountId = useRef(accountId);
  useEffect(() => {
    if (lastAccountId.current !== accountId) {
      lastAccountId.current = accountId;
      setSelected(null);
      setInputValue("");
      hydratedFor.current = null;
    }
  }, [accountId]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      hydratedFor.current = null;
      return;
    }
    if (value === hydratedFor.current || selected?.id === value) return;

    let cancelled = false;
    getContact(value)
      .then((res) => {
        if (cancelled) return;
        const opt = {
          id: res.data.id,
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          title: res.data.title,
        };
        setSelected(opt);
        setInputValue(labelFor(opt));
        hydratedFor.current = value;
      })
      .catch(() => {
        // Selected id could not be resolved.
      });
    return () => {
      cancelled = true;
    };
  }, [value, selected]);

  useEffect(() => {
    if (!accountId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPage(1);
    listContacts({
      accountId,
      page: 1,
      limit: PICKER_LIMIT,
      search: debouncedQuery || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(
          res.data.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            title: c.title,
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
  }, [accountId, debouncedQuery]);

  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore || !accountId) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await listContacts({
        accountId,
        page: next,
        limit: PICKER_LIMIT,
        search: debouncedQuery || undefined,
      });
      setItems((prev) => [
        ...prev,
        ...res.data.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          title: c.title,
        })),
      ]);
      setTotal(res.meta.total);
      setPage(next);
    } catch {
      // Silent — re-trigger by scrolling.
    } finally {
      setLoadingMore(false);
    }
  }, [accountId, debouncedQuery, hasMore, loading, loadingMore, page]);

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
      disabled={disabled || !accountId}
    >
      <ComboboxInput
        placeholder={accountId ? placeholder : "Pick an account first"}
        showClear={!!value}
      />
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
                <span className="text-sm">
                  {item.firstName} {item.lastName}
                </span>
                {item.title ? (
                  <span className="text-muted-foreground text-[11px]">
                    {item.title}
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
        <ComboboxEmpty>
          {accountId
            ? "No contacts on this account."
            : "Pick an account first."}
        </ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
