"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FundraisingEntitiesManagerDialog } from "@/components/investors/fundraising-entities-manager-dialog";
import { PermissionButton } from "@/components/shared/permission-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { useFundraisingEntity } from "@/providers/fundraising-entity-provider";
import { createFundraisingEntity } from "@/services/fundraising-entity.service";

export function FundraisingEntitySwitcher() {
  const { entities, entityKey, setEntityKey, refresh } = useFundraisingEntity();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("investors:update");
  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function addEntity() {
    const label = newLabel.trim();
    if (!label) return;
    try {
      setBusy(true);
      const res = await createFundraisingEntity({ label });
      toast.success("Entity added");
      setNewLabel("");
      setAddOpen(false);
      await refresh();
      setEntityKey(res.data.key);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to add entity",
      );
    } finally {
      setBusy(false);
    }
  }

  if (entities.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Tabs value={entityKey} onValueChange={setEntityKey}>
        <TabsList className="h-9 w-fit">
          {entities.map((e) => (
            <TabsTrigger key={e.key} value={e.key} className="px-3 text-xs">
              {e.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {canManage ? (
        <>
          <PermissionButton
            variant="outline"
            size="sm"
            permission="investors:update"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3.5" />
            Add entity
          </PermissionButton>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManageOpen(true)}
            aria-label="Manage entities"
          >
            <Pencil className="size-3.5" />
          </Button>
        </>
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add entity</DialogTitle>
          </DialogHeader>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addEntity();
            }}
            placeholder="e.g. The Binary Labs"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void addEntity()}
              disabled={busy || !newLabel.trim()}
            >
              Add entity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FundraisingEntitiesManagerDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        onChanged={() => void refresh()}
      />
    </div>
  );
}
