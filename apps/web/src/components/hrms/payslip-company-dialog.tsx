"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  getPayslipCompany,
  updatePayslipCompany,
} from "@/services/payroll.service";

interface PayslipCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Admin editor for the company legal block printed in the footer of
 * every payslip PDF/XLSX (legal name, address, tel). Single global
 * value (SystemSetting `payslip.company`).
 */
export function PayslipCompanyDialog({
  open,
  onOpenChange,
}: PayslipCompanyDialogProps) {
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPayslipCompany();
      setLegalName(res.data.legalName ?? "");
      setAddress(res.data.address ?? "");
      setPhone(res.data.phone ?? "");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load company details",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function handleSave() {
    if (saving) return;
    try {
      setSaving(true);
      await updatePayslipCompany({
        legalName: legalName.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });
      toast.success("Payslip company details saved");
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to save company details";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payslip company details</DialogTitle>
          <DialogDescription>
            Printed in the footer of every payslip (legal name, registered
            address, telephone).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-company-name">Legal name</Label>
              <Input
                id="payslip-company-name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Manut (Thailand) Co., Ltd."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-company-address">Address</Label>
              <Textarea
                id="payslip-company-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="150 T-Place Building, 7th Floor, …, Bangkok, 10110, Thailand"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-company-phone">Telephone</Label>
              <Input
                id="payslip-company-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="020590383"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
