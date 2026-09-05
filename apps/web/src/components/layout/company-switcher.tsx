"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";

/**
 * Company switcher (multi-company foundation, PRD Rule 7).
 *
 * Lists the caller's active memberships and switches the selected company
 * via `switchEntity` (PUT /auth/active-entity → refresh /me). Single-company
 * users (≤1 membership) see NOTHING — this renders `null` so their top bar is
 * byte-for-byte unchanged. Switching stores the selection only; it does not
 * gate any nav yet (per-entity enforcement is a later chunk).
 */
export function CompanySwitcher() {
  const { memberships, activeEntityId, switchEntity } = useAuth();
  const [switching, setSwitching] = useState(false);

  // Single-company (or unknown) users: render nothing so nothing changes.
  if (!memberships || memberships.length <= 1) return null;

  const active =
    memberships.find((m) => m.entityId === activeEntityId) ?? memberships[0];

  const handleSelect = async (entityId: string) => {
    if (entityId === active?.entityId || switching) return;
    setSwitching(true);
    try {
      await switchEntity(entityId);
      const next = memberships.find((m) => m.entityId === entityId);
      toast.success(`Switched to ${next?.entityName ?? "company"}`);
    } catch {
      toast.error("Could not switch company. Please try again.");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={switching}
          aria-label="Switch company"
          className={`
            text-muted-foreground h-7 gap-1.5 px-2
            hover:text-foreground
          `}
        >
          <Building2 className="size-4" aria-hidden />
          <span className="max-w-[10rem] truncate text-[13px] font-medium">
            {active?.entityName ?? active?.entityCode ?? "Company"}
          </span>
          <ChevronsUpDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.entityId}
            onSelect={() => void handleSelect(m.entityId)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px]">{m.entityName}</span>
              <span
                className={`
                  text-muted-foreground truncate text-[11px] uppercase
                `}
              >
                {m.entityCode}
              </span>
            </span>
            {m.entityId === active?.entityId ? (
              <Check className="size-4 shrink-0" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
