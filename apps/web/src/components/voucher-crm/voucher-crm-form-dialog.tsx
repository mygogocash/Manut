"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  createVoucherEntry,
  type CreateVoucherEntryInput,
  updateVoucherEntry,
  type VoucherEntry,
} from "@/services/voucher-crm.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: VoucherEntry | null;
  onSaved: (entry: VoucherEntry) => void;
}

export function VoucherCrmFormDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
}: Props) {
  const isEdit = !!entry;
  const [submitting, setSubmitting] = useState(false);
  const [partner, setPartner] = useState("");
  const [country, setCountry] = useState("");
  const [redeemed, setRedeemed] = useState("0");
  const [issued, setIssued] = useState("0");
  const [refund, setRefund] = useState("0");

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setPartner(entry.partner);
      setCountry(entry.country ?? "");
      setRedeemed(String(entry.redeemed));
      setIssued(String(entry.issued));
      setRefund(String(entry.refund));
    } else {
      setPartner("");
      setCountry("");
      setRedeemed("0");
      setIssued("0");
      setRefund("0");
    }
  }, [open, entry]);

  async function handleSubmit() {
    if (!partner.trim()) {
      toast.error("Partner is required");
      return;
    }
    setSubmitting(true);
    try {
      // Coerce the numeric fields; blank or non-numeric falls back to 0.
      const toCount = (v: string) => {
        const n = Number(v.trim());
        return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
      };
      const payload: CreateVoucherEntryInput = {
        partner: partner.trim(),
        country: country.trim() || null,
        redeemed: toCount(redeemed),
        issued: toCount(issued),
        refund: toCount(refund),
      };
      const res = entry
        ? await updateVoucherEntry(entry.id, payload)
        : await createVoucherEntry(payload);
      toast.success(entry ? "Voucher row updated" : "Voucher row added");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save voucher row";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Partner Row" : "Add Partner"}
          </DialogTitle>
          <DialogDescription>
            Track Redeemed / Issued / Refund counts per partner.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-partner">Partner *</Label>
              <Input
                id="v-partner"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                placeholder="e.g. Dialog"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-country">Country</Label>
              <Input
                id="v-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. SriLanka"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-redeemed">Redeemed</Label>
              <Input
                id="v-redeemed"
                type="number"
                min={0}
                value={redeemed}
                onChange={(e) => setRedeemed(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-issued">Issued</Label>
              <Input
                id="v-issued"
                type="number"
                min={0}
                value={issued}
                onChange={(e) => setIssued(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-refund">Refund</Label>
              <Input
                id="v-refund"
                type="number"
                min={0}
                value={refund}
                onChange={(e) => setRefund(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Add Partner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
