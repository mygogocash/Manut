"use client";

import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { RoomFormDialog } from "@/components/office/room-form-dialog";
import { Badge } from "@/components/shared/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import {
  type AdminRoom,
  deleteRoom,
  listOffices,
  listRoomsAdmin,
  type Office,
} from "@/services/office.service";

interface ManageRoomsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function ManageRoomsDialog({
  open,
  onOpenChange,
  onChanged,
}: ManageRoomsDialogProps) {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRoom | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [roomsRes, officesRes] = await Promise.all([
        listRoomsAdmin(),
        listOffices(),
      ]);
      setRooms(roomsRes.data);
      setOffices(officesRes.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load rooms";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  function handleSaved() {
    fetchAll();
    onChanged?.();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteRoom(deleteTarget.id);
      toast.success("Room deleted");
      setDeleteTarget(null);
      handleSaved();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete room";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  const noOffices = offices.length === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`
            max-h-[90vh] overflow-y-auto
            sm:max-w-3xl
          `}
        >
          <DialogHeader>
            <DialogTitle>Manage rooms</DialogTitle>
            <DialogDescription>
              Add meeting rooms and time slots auto-populate (09:00–17:00
              hourly).
            </DialogDescription>
          </DialogHeader>

          <div className="mb-3 flex items-center justify-end">
            <Button
              size="sm"
              disabled={noOffices}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" />
              New room
            </Button>
          </div>

          {noOffices && !loading ? (
            <div
              className={`
                bg-muted/30 text-muted-foreground rounded-md p-4 text-center
                text-sm
              `}
            >
              Create an office first, then come back to add rooms.
            </div>
          ) : null}

          <div className="border-border overflow-hidden rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-muted-foreground py-10 text-center text-sm">
                No rooms yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-muted-foreground text-left text-[12px]">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Office</th>
                    <th className="px-3 py-2 font-medium">Capacity</th>
                    <th className="px-3 py-2 font-medium">Amenities</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="w-20 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr
                      key={r.id}
                      className={`
                        border-border border-t
                        last:border-b-0
                      `}
                    >
                      <td className="text-foreground px-3 py-2 font-medium">
                        {r.name}
                      </td>
                      <td className="px-3 py-2">{r.office?.name ?? "—"}</td>
                      <td className="px-3 py-2">{r.capacity}</td>
                      <td className="px-3 py-2">
                        {r.amenities.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.amenities.map((a) => (
                              <Badge key={a} variant="grey">
                                {a}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={r.isActive ? "green" : "grey"}>
                          {r.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(r);
                              setFormOpen(true);
                            }}
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RoomFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        room={editing}
        offices={offices}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!deleting && !next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete room</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;
              <span className="text-foreground font-medium">
                {deleteTarget?.name}
              </span>
              &rdquo;? Existing bookings will be cascaded with the room row.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
