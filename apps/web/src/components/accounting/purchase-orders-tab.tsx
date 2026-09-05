"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  convertPoToBill,
  deletePurchaseOrder,
  listPurchaseOrders,
  PO_STATUSES,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  receivePurchaseOrder,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const STATUS_LABEL: Record<string, string> = {
  "awaiting-delivery": "Awaiting delivery",
  "partially-received": "Partially received",
};

interface PurchaseOrdersTabProps {
  entities: Entity[];
  canCreate: boolean;
  canAdmin: boolean;
}

export function PurchaseOrdersTab({
  entities,
  canCreate,
  canAdmin,
}: PurchaseOrdersTabProps) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [actingId, setActingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [receiving, setReceiving] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listPurchaseOrders({
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        status:
          statusFilter === ALL_FILTER
            ? undefined
            : (statusFilter as PurchaseOrderStatus),
      });
      setOrders(result.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load purchase orders";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, statusFilter]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  function openReceive(po: PurchaseOrder) {
    const seed: Record<string, string> = {};
    for (const l of po.lines ?? []) {
      // Default to the ordered quantity (receive in full); editable for partial.
      seed[l.id] = l.quantity;
    }
    setReceiveQtys(seed);
    setReceiveTarget(po);
  }

  async function submitReceive() {
    if (!receiveTarget) return;
    try {
      setReceiving(true);
      const lines = (receiveTarget.lines ?? []).map((l) => ({
        lineId: l.id,
        qtyReceived: Number(receiveQtys[l.id] ?? l.quantity) || 0,
      }));
      await receivePurchaseOrder(receiveTarget.id, { lines });
      toast.success(`Received ${receiveTarget.poNo}`);
      setReceiveTarget(null);
      await fetchOrders();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to receive PO";
      toast.error(msg);
    } finally {
      setReceiving(false);
    }
  }

  const handleConvert = useCallback(
    async (po: PurchaseOrder) => {
      try {
        setActingId(po.id);
        await convertPoToBill(po.id);
        toast.success(`${po.poNo} converted to a draft bill`);
        await fetchOrders();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to convert PO";
        toast.error(msg);
      } finally {
        setActingId(null);
      }
    },
    [fetchOrders],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const po = deleteTarget;
    try {
      setActingId(po.id);
      await deletePurchaseOrder(po.id);
      toast.success(`${po.poNo} deleted`);
      setDeleteTarget(null);
      await fetchOrders();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete PO";
      toast.error(msg);
    } finally {
      setActingId(null);
    }
  }, [deleteTarget, fetchOrders]);

  const columns = useMemo(
    () => [
      {
        key: "poNo",
        mobileRole: "title" as const,
        header: "Number",
        render: (po: PurchaseOrder) => (
          <span className="font-medium tabular-nums">{po.poNo}</span>
        ),
      },
      {
        key: "vendor",
        mobileRole: "subtitle" as const,
        header: "Supplier",
        render: (po: PurchaseOrder) => po.vendor?.name ?? "—",
      },
      {
        key: "orderDate",
        mobileRole: "detail" as const,
        header: "Order Date",
        render: (po: PurchaseOrder) => formatDate(po.orderDate),
      },
      {
        key: "expectedDate",
        mobileRole: "field" as const,
        header: "Expected",
        render: (po: PurchaseOrder) =>
          po.expectedDate ? formatDate(po.expectedDate) : "—",
      },
      {
        key: "grandTotal",
        mobileRole: "field" as const,
        header: "Total",
        className: "text-right",
        render: (po: PurchaseOrder) => (
          <span className="tabular-nums">{formatCurrency(po.grandTotal)}</span>
        ),
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (po: PurchaseOrder) => (
          <Badge status={po.status}>
            {STATUS_LABEL[po.status] ?? po.status}
          </Badge>
        ),
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "text-right",
        render: (po: PurchaseOrder) => {
          const busy = actingId === po.id;
          const canReceive =
            canCreate &&
            ["awaiting-delivery", "partially-received"].includes(po.status);
          const canConvert =
            canCreate &&
            ["completed", "partially-received"].includes(po.status) &&
            !po.convertedInvoiceId &&
            Boolean(po.vendorId);
          const canDelete = canAdmin && po.status !== "billed";
          if (!canReceive && !canConvert && !canDelete) return null;
          return (
            <div className="flex items-center justify-end gap-1.5">
              {canReceive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() => openReceive(po)}
                >
                  Receive
                </Button>
              ) : null}
              {canConvert ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() => handleConvert(po)}
                >
                  {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  To Bill
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => setDeleteTarget(po)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [actingId, canCreate, canAdmin, handleConvert],
  );

  const filtersDirty =
    entityFilter !== ALL_FILTER || statusFilter !== ALL_FILTER;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
          shadow-sm
          md:flex-row md:items-center
        `}
      >
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-10 min-w-[140px] text-xs">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 min-w-[150px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {PO_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersDirty ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setEntityFilter(ALL_FILTER);
              setStatusFilter(ALL_FILTER);
            }}
            className="text-xs"
          >
            Clear
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        emptyMessage="No purchase orders yet"
      />

      {/* Receive dialog — set the received quantity per line. */}
      <Dialog
        open={receiveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !receiving) setReceiveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive {receiveTarget?.poNo}</DialogTitle>
            <DialogDescription>
              Enter the quantity received per line. Fully received lines complete
              the order; partial quantities leave it open to receive the rest.
            </DialogDescription>
          </DialogHeader>

          <div
            className={`
              border-border divide-border divide-y rounded-lg border
            `}
          >
            <div
              className={`
                bg-surface-secondary text-muted-foreground grid
                grid-cols-[1fr_80px_100px] gap-2 px-3 py-2 text-[9px] font-bold
                tracking-widest uppercase
              `}
            >
              <span>Description</span>
              <span className="text-right">Ordered</span>
              <span className="text-right">Received</span>
            </div>
            {(receiveTarget?.lines ?? []).map((l) => (
              <div
                key={l.id}
                className="grid grid-cols-[1fr_80px_100px] items-center gap-2 px-3 py-2"
              >
                <span className="text-xs">{l.description}</span>
                <span className="text-right text-xs tabular-nums">
                  {Number(l.quantity)}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(l.quantity)}
                  className="h-8 text-right text-xs"
                  value={receiveQtys[l.id] ?? ""}
                  onChange={(e) =>
                    setReceiveQtys((prev) => ({
                      ...prev,
                      [l.id]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReceiveTarget(null)}
              disabled={receiving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitReceive}
              disabled={receiving}
              className="min-w-28"
            >
              {receiving ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : null}
              Record Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Purchase order ${deleteTarget.poNo} will be removed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={actingId !== null}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
