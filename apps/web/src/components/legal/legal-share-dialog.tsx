"use client";

import {
  Building2,
  Globe2,
  Loader2,
  Lock,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { RemoteUserPicker } from "@/components/crm/remote-user-picker";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  createLegalShare,
  deleteLegalShare,
  getLegalShareOptions,
  LEGAL_VISIBILITY_LABELS,
  LEGAL_VISIBILITY_VALUES,
  type LegalDocument,
  type LegalShare,
  type LegalShareOptions,
  type LegalShareType,
  type LegalVisibility,
  setLegalVisibility,
} from "@/services/legal.service";

interface LegalShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalDocument | null;
  onChanged: (doc: LegalDocument | null) => void;
}

export function LegalShareDialog({
  open,
  onOpenChange,
  document,
  onChanged,
}: LegalShareDialogProps) {
  const [visibility, setVisibility] = useState<LegalVisibility>("private");
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [shareType, setShareType] = useState<LegalShareType>("user");
  const [userId, setUserId] = useState("");
  const [department, setDepartment] = useState("");
  const [groupId, setGroupId] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyShareId, setBusyShareId] = useState<string | null>(null);
  const [options, setOptions] = useState<LegalShareOptions>({
    departments: [],
    groups: [],
  });

  useEffect(() => {
    if (!open) return;
    getLegalShareOptions()
      .then((res) => setOptions(res.data))
      .catch(() => setOptions({ departments: [], groups: [] }));
  }, [open]);

  useEffect(() => {
    if (!open || !document) return;
    setVisibility(document.visibility);
    setShareType("user");
    setUserId("");
    setDepartment("");
    setGroupId("");
  }, [open, document]);

  const shares = useMemo(() => document?.shares ?? [], [document]);

  const handleVisibilityChange = useCallback(
    async (next: LegalVisibility) => {
      if (!document) return;
      setVisibilityBusy(true);
      try {
        const res = await setLegalVisibility(document.id, next);
        setVisibility(res.data.visibility);
        onChanged(res.data);
        toast.success("Visibility updated");
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to update visibility";
        toast.error(msg);
      } finally {
        setVisibilityBusy(false);
      }
    },
    [document, onChanged],
  );

  const handleAddShare = useCallback(async () => {
    if (!document) return;
    if (shareType === "user" && !userId) {
      toast.error("Pick a person");
      return;
    }
    if (shareType === "department" && !department) {
      toast.error("Pick a department");
      return;
    }
    if (shareType === "group" && !groupId) {
      toast.error("Pick a group");
      return;
    }
    setAdding(true);
    try {
      const res = await createLegalShare(document.id, {
        type: shareType,
        userId: shareType === "user" ? userId : undefined,
        department: shareType === "department" ? department : undefined,
        groupId: shareType === "group" ? groupId : undefined,
      });
      toast.success("Share added");
      onChanged(res.data.document);
      setVisibility(res.data.document?.visibility ?? "restricted");
      setUserId("");
      setDepartment("");
      setGroupId("");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to add share";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  }, [document, shareType, userId, department, groupId, onChanged]);

  const handleRemoveShare = useCallback(
    async (share: LegalShare) => {
      if (!document) return;
      setBusyShareId(share.id);
      try {
        const res = await deleteLegalShare(document.id, share.id);
        toast.success("Share removed");
        onChanged(res.data.document);
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to remove share";
        toast.error(msg);
      } finally {
        setBusyShareId(null);
      }
    },
    [document, onChanged],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>{document?.title ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs">Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(v) =>
                void handleVisibilityChange(v as LegalVisibility)
              }
              disabled={visibilityBusy || !document}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_VISIBILITY_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {LEGAL_VISIBILITY_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {visibility === "private"
                ? "Only users with legal:read see this document."
                : visibility === "public"
                  ? "Every active employee can open and download this document."
                  : "Only the people, departments and groups listed below can see it."}
            </p>
          </div>

          {visibility === "restricted" && (
            <div className="border-border rounded-lg border p-3">
              <p className="text-foreground text-xs font-medium">Add access</p>
              <div className="mt-2 flex flex-col gap-2">
                <Select
                  value={shareType}
                  onValueChange={(v) => setShareType(v as LegalShareType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Specific person</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>

                {shareType === "user" && (
                  <RemoteUserPicker
                    value={userId}
                    onValueChange={setUserId}
                    placeholder="Search people…"
                  />
                )}
                {shareType === "department" && (
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {shareType === "group" && (
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleAddShare()}
                  disabled={adding}
                  className="self-end"
                >
                  {adding && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                  <UserPlus className="size-3.5" />
                  Add
                </Button>
              </div>
            </div>
          )}

          <div>
            <p className="text-foreground text-xs font-medium">
              Has access ({shares.length})
            </p>
            {shares.length === 0 ? (
              <p
                className={`
                  text-muted-foreground mt-1 rounded border border-dashed px-3
                  py-2 text-center text-xs
                `}
              >
                {visibility === "public"
                  ? "Everyone in the company"
                  : visibility === "private"
                    ? "Only the legal team"
                    : "No shares yet — add someone above."}
              </p>
            ) : (
              <ul className="border-border mt-1 flex flex-col gap-1.5">
                {shares.map((s) => (
                  <li
                    key={s.id}
                    className={`
                      border-border bg-surface flex items-center gap-2
                      rounded-md border px-3 py-2 text-xs
                    `}
                  >
                    <ShareIcon type={s.type} />
                    <div className="min-w-0 flex-1">
                      {s.type === "user" && s.user ? (
                        <>
                          <p className="text-foreground truncate font-medium">
                            {s.user.name}
                          </p>
                          <p
                            className={`
                              text-muted-foreground truncate text-[11px]
                            `}
                          >
                            {s.user.email}
                          </p>
                        </>
                      ) : s.type === "department" ? (
                        <>
                          <p className="text-foreground font-medium">
                            {s.department}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            Department
                          </p>
                        </>
                      ) : s.type === "group" && s.group ? (
                        <>
                          <p className="text-foreground font-medium">
                            {s.group.name}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            Group
                          </p>
                        </>
                      ) : null}
                    </div>
                    <Badge variant="grey" className="text-[10px] capitalize">
                      {s.type}
                    </Badge>
                    <button
                      type="button"
                      aria-label="Remove share"
                      disabled={busyShareId === s.id}
                      className={`
                        text-muted-foreground p-1
                        hover:text-destructive
                        disabled:opacity-50
                      `}
                      onClick={() => void handleRemoveShare(s)}
                    >
                      {busyShareId === s.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareIcon({ type }: { type: LegalShareType }) {
  if (type === "user") return <Lock className="text-bronze size-3.5" />;
  if (type === "department") {
    return <Building2 className="text-bronze size-3.5" />;
  }
  if (type === "group") return <Users className="text-bronze size-3.5" />;
  return <Globe2 className="text-bronze size-3.5" />;
}
