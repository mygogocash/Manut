"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Entity } from "@/services/entity.service";
import type { UserListItem } from "@/services/user.service";

interface SurveyFormTargetsProps {
  targetAll: boolean;
  targetEntityIds: string[];
  targetDepartments: string[];
  targetUserIds: string[];
  onChange: (next: {
    targetAll: boolean;
    targetEntityIds: string[];
    targetDepartments: string[];
    targetUserIds: string[];
  }) => void;
  entities: Entity[];
  users: UserListItem[];
  disabled?: boolean;
}

export function SurveyFormTargets({
  targetAll,
  targetEntityIds,
  targetDepartments,
  targetUserIds,
  onChange,
  entities,
  users,
  disabled,
}: SurveyFormTargetsProps) {
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      if (u.department && u.department.trim()) set.add(u.department.trim());
    }
    return [...set].sort();
  }, [users]);

  function patch(
    next: Partial<{
      targetAll: boolean;
      targetEntityIds: string[];
      targetDepartments: string[];
      targetUserIds: string[];
    }>,
  ) {
    onChange({
      targetAll,
      targetEntityIds,
      targetDepartments,
      targetUserIds,
      ...next,
    });
  }

  return (
    <div className="bg-card flex flex-col gap-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Send to everyone</Label>
          <p className="text-muted-foreground text-xs">
            When on, every active employee can respond. Turn off to target by
            entity, department, or specific people.
          </p>
        </div>
        <Switch
          checked={targetAll}
          onCheckedChange={(v) => patch({ targetAll: v })}
          disabled={disabled}
        />
      </div>

      {!targetAll && (
        <div
          className={`
            grid gap-4
            sm:grid-cols-2
          `}
        >
          <ChipPicker
            label="Entities"
            placeholder="Pick entities…"
            options={entities.map((e) => ({
              value: e.id,
              label: `${e.name} (${e.code})`,
            }))}
            value={targetEntityIds}
            onChange={(next) => patch({ targetEntityIds: next })}
            disabled={disabled}
          />

          <ChipPicker
            label="Departments"
            placeholder="Pick departments…"
            options={departmentOptions.map((d) => ({ value: d, label: d }))}
            value={targetDepartments}
            onChange={(next) => patch({ targetDepartments: next })}
            disabled={disabled}
          />

          <UserChipPicker
            users={users}
            value={targetUserIds}
            onChange={(next) => patch({ targetUserIds: next })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function ChipPicker({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const optionByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !value.includes(o.value))
      .filter((o) => (q ? o.label.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [options, value, query]);

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => {
            const opt = optionByValue.get(v);
            return (
              <span
                key={v}
                className={`
                  bg-primary/10 inline-flex items-center gap-1 rounded-md px-2
                  py-0.5 text-[11px]
                `}
              >
                {opt?.label ?? v}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((x) => x !== v))}
                    className="hover:text-destructive"
                    aria-label={`Remove ${opt?.label ?? v}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {open && filtered.length > 0 && (
          <div
            className={`
              border-border bg-popover absolute top-full z-10 mt-1 max-h-48
              w-full overflow-y-auto rounded-md border shadow-md
            `}
          >
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange([...value, o.value]);
                  setQuery("");
                }}
                className={`
                  hover:bg-accent
                  w-full px-2 py-1 text-left text-[12px]
                `}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserChipPicker({
  users,
  value,
  onChange,
  disabled,
}: {
  users: UserListItem[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
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

  return (
    <div
      className={`
        flex flex-col gap-2
        sm:col-span-2
      `}
    >
      <Label className="text-xs">Specific people</Label>
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
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((x) => x !== id))}
                    className="hover:text-destructive"
                    aria-label={`Remove ${u?.name ?? id}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input
          placeholder="Add specific people…"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {open && filtered.length > 0 && (
          <div
            className={`
              border-border bg-popover absolute top-full z-10 mt-1 max-h-48
              w-full overflow-y-auto rounded-md border shadow-md
            `}
          >
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange([...value, u.id]);
                  setQuery("");
                }}
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
