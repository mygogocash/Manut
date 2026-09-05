"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

// Compact multi-select for picking a subset of employees. Renders the
// selected names as removable chips and a searchable list of the remaining
// users. Shared by the leave approval-step dialog, the per-policy approver
// editor, and the proposal information request.

/**
 * The three fields this control actually reads. Structural rather than tied to
 * `UserListItem`, so a caller holding a leaner projection (the assignable-user
 * picker, which is readable without `directory:read`) can pass it directly.
 */
export interface SelectableUser {
  id: string;
  name: string;
  email: string;
}

export interface UserMultiSelectProps {
  users: SelectableUser[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}

export function UserMultiSelect({
  users,
  value,
  onChange,
  placeholder,
  disabled = false,
}: UserMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => !value.includes(u.id))
      .filter((u) =>
        q
          ? u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
          : true,
      )
      .slice(0, 50);
  }, [users, value, query]);

  function add(id: string) {
    if (value.includes(id)) return;
    onChange([...value, id]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const u = userById.get(id);
            return (
              <span
                key={id}
                className={`
                  bg-primary/10 inline-flex items-center gap-1 rounded-md px-2
                  py-0.5 text-[11px]
                `}
              >
                {u?.name ?? id}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  disabled={disabled}
                  className={`
                    hover:text-destructive
                    disabled:opacity-50
                  `}
                  aria-label={`Remove ${u?.name ?? id}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on a list item still registers.
            window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {open && filtered.length > 0 && (
          <div
            className={`
              border-border bg-popover absolute top-full z-10 mt-1 max-h-56
              w-full overflow-y-auto rounded-md border shadow-md
            `}
          >
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(u.id)}
                className={`
                  hover:bg-accent
                  w-full px-2 py-1 text-left text-[12px]
                `}
              >
                <span className="font-medium">{u.name}</span>{" "}
                <span className="text-muted-foreground">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
