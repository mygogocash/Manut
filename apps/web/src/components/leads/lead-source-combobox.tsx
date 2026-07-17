"use client";

import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  invalidateLeadSourceCache,
  useLeadSources,
} from "@/hooks/use-lead-sources";
import { ApiError } from "@/lib/api-client";
import { createLeadSource } from "@/services/crm-lead-source.service";

// Free-text + pick-existing combobox for the lead Source field. Replaces
// the fixed `<Select>` so reps can type a new label and have it created
// inline (POST /lead-sources) without leaving the form. The form's source
// field stores the machine `code`; this component handles the label ↔ code
// mapping so callers stay code-only.
//
// The displayed input value is the human label; pressing the chevron
// opens a filtered list of active sources plus a footer "+ Create" row
// when the typed text doesn't match any existing label or code.
export function LeadSourceCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const { sources, loading } = useLeadSources();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedLabel = useMemo(() => {
    const hit = sources.find((s) => s.code === value);
    return hit?.label ?? value ?? "";
  }, [sources, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter(
      (s) =>
        s.label.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [sources, query]);

  // Slugify the typed label into a stable machine code. Lowercase,
  // hyphenated, prefixed with `s-` when the first char would be a
  // digit (server regex requires `^[a-z]`). Empty result → "other".
  function toCode(label: string): string {
    const slug = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) return "other";
    return /^[0-9]/.test(slug) ? `s-${slug}` : slug;
  }

  const trimmedQuery = query.trim();
  const queryMatchesExisting =
    trimmedQuery.length > 0 &&
    sources.some(
      (s) =>
        s.label.toLowerCase() === trimmedQuery.toLowerCase() ||
        s.code === toCode(trimmedQuery),
    );
  const canCreate = trimmedQuery.length >= 2 && !queryMatchesExisting;

  async function handleCreate() {
    if (!canCreate || creating) return;
    const code = toCode(trimmedQuery);
    try {
      setCreating(true);
      await createLeadSource({ code, label: trimmedQuery });
      invalidateLeadSourceCache();
      onChange(code);
      setOpen(false);
      setQuery("");
      // Refetch via the hook's effect — invalidating + a state nudge
      // is enough since the hook re-fires its async fetch when remount
      // triggers. Toast keeps the rep informed.
      toast.success(`Source "${trimmedQuery}" added`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create source";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`
            h-9 w-full justify-between font-normal
            ${value ? "" : "text-muted-foreground"}
          `}
        >
          <span className="truncate">
            {value
              ? selectedLabel
              : loading
                ? "Loading…"
                : "Select or type a source"}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={`w-[var(--radix-popover-trigger-width)] p-0`}
        onOpenAutoFocus={(e) => {
          // Defer focus to the input below — Popover's default focus
          // lands on the first focusable element, which works here but
          // makes the input ungrabbable via VoiceOver without this.
          e.preventDefault();
        }}
      >
        <div className="border-border border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or create new…"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 && !canCreate ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-xs">
              {loading ? "Loading…" : "No matching sources"}
            </p>
          ) : null}
          {filtered.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => {
                onChange(s.code);
                setOpen(false);
                setQuery("");
              }}
              className={`
                hover:bg-accent
                flex w-full items-center justify-between gap-2 rounded-md px-2
                py-1.5 text-left text-sm
              `}
            >
              <span className="truncate">{s.label}</span>
              {value === s.code ? <Check className="size-3.5" /> : null}
            </button>
          ))}
        </div>
        {canCreate ? (
          <div className="border-border border-t p-1">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className={`
                hover:bg-accent
                flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left
                text-sm
                disabled:opacity-60
              `}
            >
              {creating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              <span>
                Create &ldquo;
                <span className="font-medium">{trimmedQuery}</span>&rdquo;
              </span>
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
