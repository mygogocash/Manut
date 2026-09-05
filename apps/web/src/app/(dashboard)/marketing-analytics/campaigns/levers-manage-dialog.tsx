"use client";

import { Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  createLever,
  deleteLever,
  type Lever,
  listLevers,
  updateLever,
} from "@/services/marketing-campaigns.service";

export function LeversManageDialog() {
  const [open, setOpen] = useState(false);
  const [levers, setLevers] = useState<Lever[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchLevers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listLevers(false);
      setLevers(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void fetchLevers();
  }, [open, fetchLevers]);

  async function add() {
    if (!name.trim()) return;
    try {
      setSaving(true);
      await createLever({ name: name.trim(), sortOrder: levers.length + 1 });
      setName("");
      toast.success("Lever added");
      void fetchLevers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(l: Lever) {
    try {
      await updateLever(l.id, { isActive: !l.isActive });
      void fetchLevers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this lever? It will be removed from campaigns.")) {
      return;
    }
    try {
      await deleteLever(id);
      toast.success("Deleted");
      void fetchLevers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-1 size-3.5" />
          Levers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Levers</DialogTitle>
        </DialogHeader>

        <div className="mb-2 flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New lever (e.g. WhatsApp)"
            className="h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
          <Button size="sm" onClick={add} disabled={saving}>
            <Plus className="mr-1 size-4" />
            Add
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : levers.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No levers yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {levers.map((l) => (
              <div
                key={l.id}
                className={`
                  border-border flex items-center justify-between rounded-lg
                  border px-3 py-2 text-sm
                `}
              >
                <span className="flex items-center gap-2">
                  {l.name}
                  {!l.isActive && <Badge variant="grey">Inactive</Badge>}
                </span>
                <span className="flex items-center gap-1">
                  <Button variant="ghost" size="xs" onClick={() => toggle(l)}>
                    {l.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => remove(l.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
