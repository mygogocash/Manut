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
import {
  getAssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";

// Server-backed directory picker. Mirrors RemoteAccountPicker including
// infinite scroll on the popup.
const PICKER_LIMIT = 20;
const SCROLL_THRESHOLD_PX = 80;

export interface RemoteUserPickerOption {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
}

interface RemoteUserPickerProps {
  value: string;
  onValueChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialOption?: RemoteUserPickerOption | null;
}

export function RemoteUserPicker({
  value,
  onValueChange,
  disabled,
  placeholder = "Search people…",
  initialOption,
}: RemoteUserPickerProps) {
  const [inputValue, setInputValue] = useState(initialOption?.name ?? "");
  const debouncedQuery = useDebounce(inputValue, 300);
  const [items, setItems] = useState<RemoteUserPickerOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<RemoteUserPickerOption | null>(
    initialOption ?? null,
  );
  const [forbidden, setForbidden] = useState(false);
  const hydratedFor = useRef<string | null>(initialOption?.id ?? null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      hydratedFor.current = null;
      return;
    }
    if (value === hydratedFor.current || selected?.id === value) return;

    // Parent may have an authoritative option (e.g. legal form's
    // detail.owner). Use it without round-tripping the API.
    if (initialOption && initialOption.id === value) {
      setSelected(initialOption);
      setInputValue(initialOption.name);
      hydratedFor.current = initialOption.id;
      return;
    }

    let cancelled = false;
    getAssignableUser(value)
      .then((res) => {
        if (cancelled) return;
        const opt = {
          id: res.data.id,
          name: res.data.name,
          email: res.data.email,
          jobTitle: res.data.jobTitle,
        };
        setSelected(opt);
        setInputValue(opt.name);
        hydratedFor.current = value;
      })
      .catch(() => {
        // Selected id could not be resolved.
      });
    return () => {
      cancelled = true;
    };
  }, [value, selected, initialOption]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    listAssignableUsers({
      page: 1,
      limit: PICKER_LIMIT,
      search: debouncedQuery || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(
          res.data.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            jobTitle: u.jobTitle,
          })),
        );
        setTotal(res.meta.total);
        setForbidden(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setItems([]);
          setTotal(0);
          // Surface the common case (no `directory:read`) inline so the
          // user understands why the dropdown is empty instead of
          // silently failing on submit with "Owner is required".
          setForbidden(err.status === 403);
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
      const res = await listAssignableUsers({
        page: next,
        limit: PICKER_LIMIT,
        search: debouncedQuery || undefined,
      });
      setItems((prev) => [
        ...prev,
        ...res.data.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          jobTitle: u.jobTitle,
        })),
      ]);
      setTotal(res.meta.total);
      setPage(next);
    } catch {
      // Silent — re-trigger by scrolling.
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

  // Base UI uses `itemToStringLabel` to drive what shows up in the
  // text field when an item is selected — without it, the input
  // snaps back to the raw id (and the user thinks the selection
  // vanished). Both helpers walk a small in-memory map first to
  // avoid scanning `renderedItems` on every keystroke.
  const itemMap = new Map(renderedItems.map((i) => [i.id, i] as const));
  const labelFor = (id: string) =>
    itemMap.get(id)?.name ?? selected?.name ?? "";

  return (
    <Combobox<string>
      items={renderedItems.map((i) => i.id)}
      filter={null}
      value={value || null}
      itemToStringLabel={labelFor}
      itemToStringValue={labelFor}
      onValueChange={(v) => {
        const next = v ?? "";
        onValueChange(next);
        if (!next) {
          setSelected(null);
          setInputValue("");
          hydratedFor.current = null;
          return;
        }
        const found = itemMap.get(next);
        if (found) {
          setSelected(found);
          setInputValue(found.name);
          hydratedFor.current = found.id;
        }
      }}
      inputValue={inputValue}
      onInputValueChange={(v) => setInputValue(v)}
      disabled={disabled}
    >
      <ComboboxInput placeholder={placeholder} showClear={!!value} />
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
          {!loading && forbidden ? (
            <div className="text-muted-foreground px-3 py-3 text-xs">
              You don&apos;t have permission to search the directory. Ask an
              admin to grant <code>directory:read</code>.
            </div>
          ) : null}
          {renderedItems.map((item) => (
            <ComboboxItem key={item.id} value={item.id}>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{item.name}</span>
                <span className="text-muted-foreground text-[11px]">
                  {item.jobTitle ? `${item.jobTitle} · ` : ""}
                  {item.email}
                </span>
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
        <ComboboxEmpty>No people match.</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
