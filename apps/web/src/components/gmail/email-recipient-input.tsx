"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import {
  listAssignableUsers,
  listDirectory,
} from "@/services/directory.service";

interface Suggestion {
  name: string;
  email: string;
}

interface EmailRecipientInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function matchesQuery(s: Suggestion, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    s.name.toLowerCase().includes(lower) ||
    s.email.toLowerCase().includes(lower)
  );
}

export function EmailRecipientInput({
  id: idProp,
  value,
  onChange,
  placeholder = "Search name or email…",
  disabled,
}: EmailRecipientInputProps) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(value, 200);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (search?: string) => {
    setLoading(true);
    const params = { page: 1, limit: 12, search: search?.trim() || undefined };
    try {
      const res = await listAssignableUsers(params);
      setPool(res.data.map((u) => ({ name: u.name, email: u.email })));
    } catch {
      try {
        const res = await listDirectory(params);
        setPool(res.data.map((u) => ({ name: u.name, email: u.email })));
      } catch {
        setPool([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchSuggestions(debouncedQuery);
  }, [open, debouncedQuery, fetchSuggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: Suggestion) {
    onChange(s.email);
    setOpen(false);
  }

  const q = value.trim();
  const filtered =
    q.length >= 1 ? pool.filter((s) => matchesQuery(s, q)) : pool.slice(0, 8);

  const showList = open && (loading || filtered.length > 0);

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        id={inputId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={`
          border-0 bg-transparent shadow-none
          focus-visible:ring-0
        `}
      />
      {showList ? (
        <ul
          className={cn(
            `
              bg-popover text-popover-foreground absolute top-full right-0
              left-0 z-[250] mt-1 max-h-52 overflow-auto rounded-md border py-1
              shadow-lg
            `,
          )}
          role="listbox"
        >
          {loading && filtered.length === 0 ? (
            <li
              className={`
                text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm
              `}
            >
              <Loader2 className="size-3.5 animate-spin" />
              Searching…
            </li>
          ) : (
            filtered.map((s) => (
              <li key={s.email}>
                <button
                  type="button"
                  role="option"
                  className={`
                    hover:bg-muted
                    flex w-full flex-col px-3 py-2 text-left text-sm
                  `}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {s.email}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
