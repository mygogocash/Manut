"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type FixedAsset,
  submitFixedAssetDisposal,
} from "@/services/accounting.service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const schema = z
  .object({
    disposalType: z.enum(["disposal", "write_off"]),
    disposalDate: z.string().min(1, "Disposal date is required"),
    unitsDisposed: z.string().min(1),
    proceeds: z.string(),
    reason: z.string().max(2000),
  })
  .refine((v) => Number(v.unitsDisposed) >= 1, {
    message: "At least 1 unit",
    path: ["unitsDisposed"],
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
  onSaved: () => void;
}

export function FixedAssetDisposeDialog({
  open,
  onOpenChange,
  asset,
  onSaved,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      disposalType: "disposal",
      disposalDate: todayIso(),
      unitsDisposed: "1",
      proceeds: "0",
      reason: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        disposalType: "disposal",
        disposalDate: todayIso(),
        unitsDisposed: asset ? String(asset.quantity) : "1",
        proceeds: "0",
        reason: "",
      });
    }
  }, [open, asset, form]);

  const disposalType = form.watch("disposalType");
  const isWriteOff = disposalType === "write_off";

  async function onSubmit(values: FormValues) {
    if (!asset) return;
    const units = Number(values.unitsDisposed);
    if (units > asset.quantity) {
      form.setError("unitsDisposed", {
        message: `Only ${asset.quantity} unit(s) on hand`,
      });
      return;
    }
    try {
      setSubmitting(true);
      await submitFixedAssetDisposal(asset.id, {
        disposalType: values.disposalType,
        disposalDate: values.disposalDate,
        unitsDisposed: units,
        proceeds: isWriteOff ? 0 : Number(values.proceeds || 0),
        reason: values.reason.trim() || null,
      });
      toast.success("Disposal submitted for approval");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to submit disposal",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dispose / write off asset</DialogTitle>
          <DialogDescription>
            {asset
              ? `${asset.assetNo} — ${asset.name} (${asset.quantity} unit(s)). Depreciation runs to and including the disposal date; the request needs approval.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="fa-dispose-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="disposalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="disposal">
                        Disposal (sold, with proceeds)
                      </SelectItem>
                      <SelectItem value="write_off">
                        Write-off (no proceeds)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="disposalDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disposal date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unitsDisposed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Units disposed</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      max={asset?.quantity}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A partial disposal keeps the rest of the line active.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isWriteOff && (
              <FormField
                control={form.control}
                name="proceeds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling price (excl. VAT)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason / note</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="fa-dispose-form" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
