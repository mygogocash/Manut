"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { RemoteUserPicker } from "@/components/crm/remote-user-picker";
import { FormDatePicker } from "@/components/shared/form-date-picker";
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
  type Asset,
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_STATUSES,
  createAsset,
  listOffices,
  type Office,
  updateAsset,
} from "@/services/office.service";

// Field names mirror the server contract (type / serialNo / officeId /
// assignedTo). UI labels stay friendly ("Category", "Serial number",
// "Office") — the rep doesn't see the wire shape.
const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  type: z.string().min(1, "Category is required"),
  serialNo: z.string().max(200).optional().or(z.literal("")),
  officeId: z.string().min(1, "Office is required"),
  status: z.string().min(1, "Status is required"),
  // Optional — must be a UUID when present so the server's zod check
  // doesn't reject the request mid-form.
  assignedTo: z
    .string()
    .uuid("Must be a valid employee UUID")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  manufacturer: z.string().max(120).optional().or(z.literal("")),
  model: z.string().max(120).optional().or(z.literal("")),
  colour: z.string().max(60).optional().or(z.literal("")),
  subType: z.string().max(120).optional().or(z.literal("")),
  operatingSystem: z.string().max(60).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  supportLink: z
    .string()
    .url("Must be a valid URL")
    .max(500)
    .optional()
    .or(z.literal("")),
  activeServiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  department: z.string().max(120).optional().or(z.literal("")),
  assetCode: z.string().max(120).optional().or(z.literal("")),
  version: z.string().max(60).optional().or(z.literal("")),
  // Numeric fields shipped as strings so a blank input lands as "" and
  // the server-bound payload can collapse to undefined. Parsed in
  // onSubmit before hitting the API.
  quantity: z.string().regex(/^\d+$/, "Must be a positive integer"),
  usefulLifeMonths: z
    .string()
    .regex(/^\d*$/, "Must be a non-negative integer")
    .optional()
    .or(z.literal("")),
  bookValue: z
    .string()
    .regex(/^\d*(\.\d+)?$/, "Must be a non-negative number")
    .optional()
    .or(z.literal("")),
  disposalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  sellingPrice: z
    .string()
    .regex(/^\d*(\.\d+)?$/, "Must be a non-negative number")
    .optional()
    .or(z.literal("")),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  purchaseCost: z
    .string()
    .regex(/^\d*(\.\d+)?$/, "Must be a non-negative number")
    .optional()
    .or(z.literal("")),
});

function toOptionalNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// Categories that surface their own conditional inputs in the form.
// Anything not listed here just shows the common fieldset.
const HARDWARE_CATEGORIES = new Set([
  "laptop",
  "mobile",
  "monitor",
  "peripheral",
  "usb_accessory",
]);
const COLOURED_CATEGORIES = new Set(["mobile", "peripheral", "usb_accessory"]);
const OS_CATEGORIES = new Set(["laptop", "mobile"]);
const SOFTWARE_CATEGORY = "software";

type FormValues = z.infer<typeof formSchema>;

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset | null;
  onSaved: () => void;
}

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  onSaved,
}: AssetFormDialogProps) {
  const isEditing = !!asset;
  const [submitting, setSubmitting] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [officesLoading, setOfficesLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      serialNo: "",
      officeId: "",
      status: "available",
      assignedTo: "",
      notes: "",
      manufacturer: "",
      model: "",
      colour: "",
      subType: "",
      operatingSystem: "",
      description: "",
      supportLink: "",
      activeServiceDate: "",
      department: "",
      assetCode: "",
      version: "",
      quantity: "1",
      usefulLifeMonths: "",
      bookValue: "",
      disposalDate: "",
      sellingPrice: "",
      purchaseDate: "",
      purchaseCost: "",
    },
  });

  const watchedType = form.watch("type");

  // Load offices once per dialog open. The server requires a real
  // officeId on create — without this the previous free-text field
  // shipped an empty string and the create call 400'd.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOfficesLoading(true);
    listOffices()
      .then((res) => {
        if (!cancelled) setOffices(res.data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load offices");
      })
      .finally(() => {
        if (!cancelled) setOfficesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (asset) {
      form.reset({
        name: asset.name,
        type: asset.type,
        serialNo: asset.serialNo ?? "",
        officeId: asset.officeId,
        status: asset.status,
        assignedTo: asset.assignee?.id ?? "",
        notes: asset.notes ?? "",
        manufacturer: asset.manufacturer ?? "",
        model: asset.model ?? "",
        colour: asset.colour ?? "",
        subType: asset.subType ?? "",
        operatingSystem: asset.operatingSystem ?? "",
        description: asset.description ?? "",
        supportLink: asset.supportLink ?? "",
        activeServiceDate: asset.activeServiceDate ?? "",
        department: asset.department ?? "",
        assetCode: asset.assetCode ?? "",
        version: asset.version ?? "",
        quantity: String(asset.quantity ?? 1),
        usefulLifeMonths:
          asset.usefulLifeMonths != null ? String(asset.usefulLifeMonths) : "",
        bookValue: asset.bookValue != null ? String(asset.bookValue) : "",
        disposalDate: asset.disposalDate ?? "",
        sellingPrice:
          asset.sellingPrice != null ? String(asset.sellingPrice) : "",
        purchaseDate: asset.purchaseDate ?? "",
        purchaseCost:
          asset.purchaseCost != null ? String(asset.purchaseCost) : "",
      });
    } else {
      form.reset({
        name: "",
        type: "",
        serialNo: "",
        officeId: "",
        status: "available",
        assignedTo: "",
        notes: "",
        manufacturer: "",
        model: "",
        colour: "",
        subType: "",
        operatingSystem: "",
        description: "",
        supportLink: "",
        activeServiceDate: "",
        department: "",
        assetCode: "",
        version: "",
        quantity: "1",
        usefulLifeMonths: "",
        bookValue: "",
        disposalDate: "",
        sellingPrice: "",
        purchaseDate: "",
        purchaseCost: "",
      });
    }
  }, [open, asset, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        name: values.name,
        type: values.type,
        serialNo: values.serialNo || undefined,
        officeId: values.officeId,
        status: values.status,
        assignedTo: values.assignedTo || undefined,
        notes: values.notes || undefined,
        manufacturer: values.manufacturer || undefined,
        model: values.model || undefined,
        colour: values.colour || undefined,
        subType: values.subType || undefined,
        operatingSystem: values.operatingSystem || undefined,
        description: values.description || undefined,
        supportLink: values.supportLink || undefined,
        activeServiceDate: values.activeServiceDate || undefined,
        department: values.department || undefined,
        assetCode: values.assetCode || undefined,
        version: values.version || undefined,
        quantity: toOptionalNumber(values.quantity) ?? 1,
        usefulLifeMonths: toOptionalNumber(values.usefulLifeMonths),
        bookValue: toOptionalNumber(values.bookValue),
        disposalDate: values.disposalDate || undefined,
        sellingPrice: toOptionalNumber(values.sellingPrice),
        purchaseDate: values.purchaseDate || undefined,
        purchaseCost: toOptionalNumber(values.purchaseCost),
      };

      if (isEditing) {
        await updateAsset(asset.id, payload);
        toast.success("Asset updated");
      } else {
        await createAsset(payload);
        toast.success("Asset created");
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      toast.error(message);
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
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit asset" : "New asset"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for "${asset.name}".`
              : "Register a new office asset."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="asset-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. MacBook Pro 16″" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSET_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {ASSET_CATEGORY_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSET_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ASSET_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="serialNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SN-12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="officeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={officesLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              officesLoading
                                ? "Loading offices…"
                                : "Select office"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {offices.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                            {o.city ? ` · ${o.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned to</FormLabel>
                  <FormControl>
                    <RemoteUserPicker
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder="Search employees by name or email…"
                      initialOption={
                        asset?.assignee
                          ? {
                              id: asset.assignee.id,
                              name: asset.assignee.name,
                              email: asset.assignee.email,
                              jobTitle: null,
                            }
                          : null
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(HARDWARE_CATEGORIES.has(watchedType) ||
              watchedType === SOFTWARE_CATEGORY) && (
              <fieldset
                className={`
                  border-border flex flex-col gap-3 rounded-md border p-3
                `}
              >
                <legend
                  className={`
                    text-muted-foreground px-1 text-[11px] font-semibold
                    tracking-wide uppercase
                  `}
                >
                  {watchedType === SOFTWARE_CATEGORY ? "Software" : "Hardware"}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Apple, Logitech, Adobe"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. M350s, U3223QE" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {watchedType === SOFTWARE_CATEGORY && (
                  <FormField
                    control={form.control}
                    name="version"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Version</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 3.15.0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {OS_CATEGORIES.has(watchedType) && (
                  <FormField
                    control={form.control}
                    name="operatingSystem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operating system</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. macOS, Windows, Android"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {COLOURED_CATEGORIES.has(watchedType) && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="colour"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Colour</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Black" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sub-type</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Power Adapter, USB-C Hub"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {watchedType !== SOFTWARE_CATEGORY && (
                  <FormField
                    control={form.control}
                    name="supportLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support link</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://manufacturer.example/product"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>
            )}

            <fieldset
              className={`
                border-border flex flex-col gap-3 rounded-md border p-3
              `}
            >
              <legend
                className={`
                  text-muted-foreground px-1 text-[11px] font-semibold
                  tracking-wide uppercase
                `}
              >
                Tracking
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Engineering, HR" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="activeServiceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Active service date</FormLabel>
                      <FormControl>
                        <FormDatePicker {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="assetCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset code (sticker)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Auto-generated from serial + service date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <fieldset
              className={`
                border-border flex flex-col gap-3 rounded-md border p-3
              `}
            >
              <legend
                className={`
                  text-muted-foreground px-1 text-[11px] font-semibold
                  tracking-wide uppercase
                `}
              >
                Accounting
              </legend>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase date</FormLabel>
                      <FormControl>
                        <FormDatePicker {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchaseCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase cost</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="usefulLifeMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Useful life (months)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bookValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Book value</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling price (excl VAT)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="disposalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disposal date</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes…"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="asset-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
