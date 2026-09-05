"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { invalidateInvestorTagCache } from "@/hooks/use-investor-tags";
import { ApiError } from "@/lib/api-client";
import {
  createInvestorTag,
  deleteInvestorTag,
  INVESTOR_TAG_COLORS,
  type InvestorTag,
  investorTagUsage,
  listInvestorTags,
  updateInvestorTag,
} from "@/services/investor-tag.service";

/**
 * Manage the investor tag catalog: add, rename, recolour, deactivate, delete.
 *
 * NOTE FOR THE NEXT PERSON: this is ~90% the same component as
 * `crm/business-units-manager-dialog.tsx`, and a third copy should not be
 * written. The two differ only in the service module they call and the copy.
 * Generalising them into one `<ManagedListDialog resource={...}>` is worth
 * doing — it was not done here because that means editing a dialog already
 * shipping in Sales CRM, which is a separate change with its own blast
 * radius.
 */

/** Codes are lowercase/dash-only, so derive one from the label as a default. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

interface InvestorTagsManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any successful mutation so the caller can refetch rows. */
  onChanged?: () => void;
}

export function InvestorTagsManagerDialog({
  open,
  onOpenChange,
  onChanged,
}: InvestorTagsManagerDialogProps) {
  const [tags, setTags] = useState<InvestorTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>("grey");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Inactive rows included: this dialog is where you reactivate one.
      const res = await listInvestorTags({ includeInactive: true });
      setTags(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load tags",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  /** Every mutation funnels through here so the shared cache cannot go stale. */
  const afterMutation = useCallback(async () => {
    invalidateInvestorTagCache();
    await load();
    onChanged?.();
  }, [load, onChanged]);

  async function handleCreate() {
    const label = newLabel.trim();
    if (!label) return;
    const code = slugify(label);
    if (code.length < 2) {
      toast.error("Label must contain at least two letters or digits.");
      return;
    }
    setCreating(true);
    try {
      await createInvestorTag({ code, label, color: newColor });
      setNewLabel("");
      setNewColor("grey");
      toast.success(`Tag "${label}" created`);
      await afterMutation();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(tag: InvestorTag, patch: Partial<InvestorTag>) {
    setBusyId(tag.id);
    try {
      await updateInvestorTag(tag.id, {
        ...(patch.label !== undefined && { label: patch.label }),
        ...(patch.color !== undefined && { color: patch.color }),
        ...(patch.isActive !== undefined && { isActive: patch.isActive }),
      });
      await afterMutation();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
      // Reload so a rejected edit does not linger in the inputs.
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(tag: InvestorTag) {
    setBusyId(tag.id);
    try {
      // Ask the server how many rows this touches, so the confirm names a
      // real number instead of asking for a blind yes.
      const { data } = await investorTagUsage(tag.code);
      const msg =
        data.count > 0
          ? `Delete "${tag.label}"? This removes the tag from ${data.count} investor${data.count === 1 ? "" : "s"}. The investors themselves are not deleted.\n\nTo keep the history instead, switch it to inactive.`
          : `Delete "${tag.label}"? No investors currently carry it.`;
      if (!confirm(msg)) return;

      const res = await deleteInvestorTag(tag.id);
      toast.success(
        res.data.investorsUntagged > 0
          ? `Deleted — untagged ${res.data.investorsUntagged} investor(s)`
          : "Deleted",
      );
      await afterMutation();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        `sm:` prefix is load-bearing. DialogContent's base class ends in
        `sm:max-w-sm`, and at >=640px that variant beats a bare `max-w-2xl`,
        so the override was dead CSS and the dialog rendered at 384px. A row
        needs ~630px (badge 96 + code 112 + colour 104 + active 80 + delete 28
        + 5 gaps + the label input), which is why the colour select and the
        delete button sat behind a horizontal scrollbar.
      */}
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tag management</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Add */}
          <div
            className={`
              border-border flex flex-wrap items-end gap-2 rounded-md border p-3
            `}
          >
            {/* min-w keeps the name field usable once it wraps to its own row. */}
            <div className="min-w-[12rem] flex-1">
              <Label className="mb-1 block text-xs">New tag</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Seed checks"
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
              {newLabel.trim() ? (
                <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                  code: {slugify(newLabel) || "—"}
                </p>
              ) : null}
            </div>
            <div>
              <Label className="mb-1 block text-xs">Colour</Label>
              <Select value={newColor} onValueChange={setNewColor}>
                <SelectTrigger className="h-9 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVESTOR_TAG_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || !newLabel.trim()}
              size="sm"
              className="h-9"
            >
              {creating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Add
            </Button>
          </div>

          {/* List */}
          {loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Loading…
            </p>
          ) : tags.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No tags yet. Add one above.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {/*
                `sm:contents` is what keeps ONE markup tree serving both
                layouts: on a phone each wrapper is a real flex row, so the
                controls stack; from sm up the wrappers stop generating
                boxes and their children become direct items of the <li>,
                restoring the single flat row. Without the grouping a plain
                flex-wrap puts 452px of controls on one line, which still
                overflows the ~311px of content a 375px phone leaves inside
                this dialog.
              */}
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className={`
                    flex flex-col gap-2 py-3
                    sm:flex-row sm:items-center sm:gap-3 sm:py-2
                  `}
                >
                  <div
                    className={`
                      flex items-center gap-2
                      sm:contents
                    `}
                  >
                    <div className="w-24 shrink-0">
                      <Badge
                        variant={
                          (INVESTOR_TAG_COLORS as readonly string[]).includes(
                            tag.color,
                          )
                            ? (tag.color as "grey")
                            : "grey"
                        }
                      >
                        {tag.label}
                      </Badge>
                    </div>

                    <Input
                      defaultValue={tag.label}
                      disabled={tag.isSystem || busyId === tag.id}
                      className="h-8 min-w-0 flex-1 text-xs"
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== tag.label) {
                          void handleUpdate(tag, { label: next });
                        }
                      }}
                    />
                  </div>

                  {/*
                    flex-wrap here too: the code slug takes a full row on a
                    phone (w-full) so colour + active + delete fit the next one
                    at 228px. From sm up `contents` dissolves this wrapper.
                  */}
                  <div
                    className={`
                      flex flex-wrap items-center gap-2
                      sm:contents
                    `}
                  >
                    <span
                      className={`
                        text-muted-foreground w-full truncate font-mono
                        text-[11px]
                        sm:w-28 sm:shrink-0
                      `}
                      title={tag.code}
                    >
                      {tag.code}
                    </span>

                    <Select
                      value={tag.color}
                      onValueChange={(c) =>
                        void handleUpdate(tag, { color: c })
                      }
                    >
                      <SelectTrigger className="h-8 w-[104px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVESTOR_TAG_COLORS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div
                      className="flex w-20 shrink-0 items-center gap-1.5"
                      title="Inactive tags stay on their investors but drop out of the pickers and filters"
                    >
                      <Switch
                        checked={tag.isActive}
                        disabled={busyId === tag.id}
                        onCheckedChange={(v) =>
                          void handleUpdate(tag, { isActive: v })
                        }
                      />
                      <span className="text-muted-foreground text-[11px]">
                        {tag.isActive ? "Active" : "Off"}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Delete ${tag.label}`}
                      // A system tag can be deactivated but never deleted, so
                      // history cannot be silently rewritten.
                      disabled={tag.isSystem || busyId === tag.id}
                      onClick={() => void handleDelete(tag)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
