"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ISO_CURRENCIES } from "@nexora/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  trackTravelRequestCancelled,
  trackTravelRequestStarted,
} from "@/lib/events";
import {
  createTravelRequest,
  FLIGHT_TYPE_LABELS,
  FLIGHT_TYPES,
  HOTEL_LOCATION_PREFERENCE_LABELS,
  HOTEL_LOCATION_PREFERENCES,
  SEATING_PREFERENCE_LABELS,
  SEATING_PREFERENCES,
} from "@/services/travel.service";

// Currencies the company actually pays in surface at the top of the
// dropdown so the common cases stay one click away; the full ISO 4217
// list follows below the divider for anyone needing something exotic.
const PRIMARY_CURRENCY_CODES = ["USD", "AED", "THB", "EUR", "GBP", "SGD"];

const schema = z
  .object({
    origin: z.string().min(1, "Origin is required"),
    destination: z.string().min(1, "Destination is required"),
    purpose: z.string().min(1, "Purpose is required"),
    departureDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Departure date is required"),
    returnDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Return date is required"),
    estimatedBudget: z.coerce.number().positive().optional(),
    cashAdvance: z.coerce.number().nonnegative().optional(),
    currency: z.string().min(1),
    category: z.enum(["general", "business_or_bd"]),
    flightType: z.enum(FLIGHT_TYPES).optional(),
    departureTimePreference: z.string().max(100).optional(),
    returnTimePreference: z.string().max(100).optional(),
    mealPreference: z.string().max(200).optional(),
    seatingPreference: z.enum(SEATING_PREFERENCES).optional(),
    seatingPreferenceOther: z.string().max(200).optional(),
    dummyTicketRequired: z.boolean(),
    visaRequired: z.boolean(),
    hotelRequired: z.boolean(),
    hotelLocationPreference: z.enum(HOTEL_LOCATION_PREFERENCES).optional(),
    preferredHotel: z.string().max(200).optional(),
    hotelDetails: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((data) => data.returnDate >= data.departureDate, {
    message: "Return date must not be before departure date",
    path: ["returnDate"],
  })
  .refine(
    (data) =>
      data.cashAdvance === undefined ||
      data.estimatedBudget === undefined ||
      data.cashAdvance <= data.estimatedBudget,
    {
      message: "Cash advance must not exceed the estimated budget",
      path: ["cashAdvance"],
    },
  );

type FormValues = z.infer<typeof schema>;

interface TravelRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div
      className={`
        border-border/50 flex justify-between border-b py-1.5 text-sm
        last:border-0
      `}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}

export function TravelRequestDialog({
  open,
  onOpenChange,
  onCreated,
}: TravelRequestDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const submittedRef = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      origin: "",
      destination: "",
      purpose: "",
      departureDate: "",
      returnDate: "",
      estimatedBudget: undefined,
      cashAdvance: undefined,
      currency: "USD",
      category: "general",
      flightType: undefined,
      departureTimePreference: "",
      returnTimePreference: "",
      mealPreference: "",
      seatingPreference: undefined,
      seatingPreferenceOther: "",
      dummyTicketRequired: false,
      visaRequired: false,
      hotelRequired: false,
      hotelLocationPreference: undefined,
      preferredHotel: "",
      hotelDetails: "",
      notes: "",
    },
  });

  const currencyOptions = useMemo(() => {
    const primaries = PRIMARY_CURRENCY_CODES.map((code) =>
      ISO_CURRENCIES.find((c) => c.code === code),
    ).filter((c): c is (typeof ISO_CURRENCIES)[number] => c !== undefined);
    const primarySet = new Set(primaries.map((c) => c.code));
    const rest = ISO_CURRENCIES.filter((c) => !primarySet.has(c.code));
    return { primaries, rest };
  }, []);

  const departureWatch = form.watch("departureDate");
  const returnWatch = form.watch("returnDate");

  useEffect(() => {
    if (open) {
      submittedRef.current = false;
      trackTravelRequestStarted();
      setStep(1);
      form.reset({
        origin: "",
        destination: "",
        purpose: "",
        departureDate: "",
        returnDate: "",
        estimatedBudget: undefined,
        cashAdvance: undefined,
        currency: "USD",
        flightType: undefined,
        departureTimePreference: "",
        returnTimePreference: "",
        mealPreference: "",
        seatingPreference: undefined,
        seatingPreferenceOther: "",
        dummyTicketRequired: false,
        visaRequired: false,
        hotelRequired: false,
        hotelLocationPreference: undefined,
        preferredHotel: "",
        hotelDetails: "",
        notes: "",
      });
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    if (step === 1) {
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      await createTravelRequest({
        origin: values.origin,
        destination: values.destination,
        purpose: values.purpose,
        departureDate: values.departureDate,
        returnDate: values.returnDate,
        ...(values.estimatedBudget !== undefined && {
          estimatedBudget: values.estimatedBudget,
        }),
        ...(values.cashAdvance !== undefined && {
          cashAdvance: values.cashAdvance,
        }),
        currency: values.currency,
        ...(values.flightType && { flightType: values.flightType }),
        ...(values.departureTimePreference?.trim() && {
          departureTimePreference: values.departureTimePreference,
        }),
        ...(values.returnTimePreference?.trim() && {
          returnTimePreference: values.returnTimePreference,
        }),
        ...(values.mealPreference?.trim() && {
          mealPreference: values.mealPreference,
        }),
        ...(values.seatingPreference && {
          seatingPreference: values.seatingPreference,
        }),
        ...(values.seatingPreference === "other" &&
          values.seatingPreferenceOther?.trim() && {
            seatingPreferenceOther: values.seatingPreferenceOther,
          }),
        dummyTicketRequired: values.dummyTicketRequired,
        visaRequired: values.visaRequired,
        hotelRequired: values.hotelRequired,
        ...(values.hotelRequired &&
          values.hotelLocationPreference && {
            hotelLocationPreference: values.hotelLocationPreference,
          }),
        ...(values.hotelRequired &&
          values.preferredHotel?.trim() && {
            preferredHotel: values.preferredHotel,
          }),
        ...(values.hotelRequired &&
          values.hotelDetails?.trim() && {
            hotelDetails: values.hotelDetails,
          }),
        ...(values.notes?.trim() && { notes: values.notes }),
      });
      toast.success("Travel request submitted");
      submittedRef.current = true;
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to submit travel request";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next && !submittedRef.current) {
          trackTravelRequestCancelled();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[90vh] overflow-y-auto
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "New travel request" : "Review your request"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Submit a business travel request for approval."
              : "Please review the details below before confirming."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {step === 1 ? (
              <>
                <div
                  className={`
                    grid grid-cols-1 gap-4
                    sm:grid-cols-2
                  `}
                >
                  <FormField
                    control={form.control}
                    name="origin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From</FormLabel>
                        <FormControl>
                          <Input placeholder="City / region" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="destination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To</FormLabel>
                        <FormControl>
                          <Input placeholder="City / region" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Meeting, conference, client visit…"
                          className="min-h-[72px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div
                  className={`
                    grid grid-cols-1 gap-4
                    sm:grid-cols-2
                  `}
                >
                  <FormField
                    control={form.control}
                    name="departureDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departure</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value}
                            onChange={field.onChange}
                            maxDate={returnWatch || undefined}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="returnDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Return</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value}
                            onChange={field.onChange}
                            minDate={departureWatch || undefined}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={`
                    grid grid-cols-1 gap-4
                    sm:grid-cols-2
                  `}
                >
                  <FormField
                    control={form.control}
                    name="estimatedBudget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated budget (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0"
                            value={field.value === undefined ? "" : field.value}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v === "" ? undefined : Number(v));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[280px]">
                            {currencyOptions.primaries.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.code} — {c.name}
                              </SelectItem>
                            ))}
                            <div className="bg-border my-1 h-px" aria-hidden />
                            {currencyOptions.rest.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.code} — {c.name}
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
                  name="cashAdvance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cash advance (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="Amount paid up-front to the traveler"
                          value={field.value === undefined ? "" : field.value}
                          onChange={(e) => {
                            const v = e.target.value;
                            field.onChange(v === "" ? undefined : Number(v));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="business_or_bd">
                            Business travel / BD
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Drives amount-band approval routing. Pick
                        &ldquo;Business travel / BD&rdquo; for BD-related trips.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div
                  className={`
                    border-border/60 grid grid-cols-1 gap-3 rounded-lg border
                    p-3
                    sm:grid-cols-2
                  `}
                >
                  <div className="sm:col-span-2">
                    <div className="text-foreground text-sm font-semibold">
                      Flight preferences
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="flightType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flight ticket request</FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(v) =>
                            field.onChange(
                              v ? (v as typeof field.value) : undefined,
                            )
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select trip type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FLIGHT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {FLIGHT_TYPE_LABELS[t]}
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
                    name="seatingPreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seating preference</FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(v) =>
                            field.onChange(
                              v ? (v as typeof field.value) : undefined,
                            )
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select seat" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SEATING_PREFERENCES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {SEATING_PREFERENCE_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("seatingPreference") === "other" && (
                    <FormField
                      control={form.control}
                      name="seatingPreferenceOther"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Other seat preference</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Bulkhead, extra legroom, etc."
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
                    name="departureTimePreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departure time preference</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Morning, after 14:00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="returnTimePreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Return time preference</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Evening, before 18:00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mealPreference"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Meal preference (if available)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Vegetarian, halal, gluten-free…"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div
                  className={`
                    border-border/60 grid grid-cols-1 gap-3 rounded-lg border
                    p-3
                    sm:grid-cols-2
                  `}
                >
                  <FormField
                    control={form.control}
                    name="dummyTicketRequired"
                    render={({ field }) => (
                      <FormItem
                        className={`
                          flex flex-row items-center justify-between rounded-md
                          border p-2.5
                        `}
                      >
                        <FormLabel className="m-0">
                          Dummy ticket required
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="visaRequired"
                    render={({ field }) => (
                      <FormItem
                        className={`
                          flex flex-row items-center justify-between rounded-md
                          border p-2.5
                        `}
                      >
                        <FormLabel className="m-0">Visa required</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="hotelRequired"
                  render={({ field }) => (
                    <FormItem
                      className={`
                        flex flex-row items-center justify-between rounded-lg
                        border p-3
                      `}
                    >
                      <div className="space-y-0.5">
                        <FormLabel>Hotel required</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue("hotelDetails", "");
                              form.setValue("preferredHotel", "");
                              form.setValue(
                                "hotelLocationPreference",
                                undefined,
                              );
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch("hotelRequired") && (
                  <>
                    <FormField
                      control={form.control}
                      name="hotelLocationPreference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hotel location preference</FormLabel>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(v) =>
                              field.onChange(
                                v ? (v as typeof field.value) : undefined,
                              )
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {HOTEL_LOCATION_PREFERENCES.map((l) => (
                                <SelectItem key={l} value={l}>
                                  {HOTEL_LOCATION_PREFERENCE_LABELS[l]}
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
                      name="preferredHotel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred hotel (if available)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Hotel name or chain"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hotelDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hotel details</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Check-in/out dates, room type, special requests…"
                              className="min-h-[72px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[60px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <div className="space-y-1">
                <SummaryRow label="From" value={form.getValues("origin")} />
                <SummaryRow label="To" value={form.getValues("destination")} />
                <SummaryRow label="Purpose" value={form.getValues("purpose")} />
                <SummaryRow
                  label="Departure"
                  value={form.getValues("departureDate")}
                />
                <SummaryRow
                  label="Return"
                  value={form.getValues("returnDate")}
                />
                {form.getValues("estimatedBudget") && (
                  <SummaryRow
                    label="Budget"
                    value={`${form.getValues("currency")} ${form.getValues("estimatedBudget")}`}
                  />
                )}
                {form.getValues("cashAdvance") !== undefined && (
                  <SummaryRow
                    label="Cash advance"
                    value={`${form.getValues("currency")} ${form.getValues("cashAdvance")}`}
                  />
                )}
                {form.getValues("flightType") && (
                  <SummaryRow
                    label="Flight"
                    value={FLIGHT_TYPE_LABELS[form.getValues("flightType")!]}
                  />
                )}
                {form.getValues("seatingPreference") && (
                  <SummaryRow
                    label="Seat"
                    value={
                      form.getValues("seatingPreference") === "other"
                        ? form.getValues("seatingPreferenceOther") ||
                          SEATING_PREFERENCE_LABELS.other
                        : SEATING_PREFERENCE_LABELS[
                            form.getValues("seatingPreference")!
                          ]
                    }
                  />
                )}
                {form.getValues("departureTimePreference") && (
                  <SummaryRow
                    label="Departure time"
                    value={form.getValues("departureTimePreference")}
                  />
                )}
                {form.getValues("returnTimePreference") && (
                  <SummaryRow
                    label="Return time"
                    value={form.getValues("returnTimePreference")}
                  />
                )}
                {form.getValues("mealPreference") && (
                  <SummaryRow
                    label="Meal"
                    value={form.getValues("mealPreference")}
                  />
                )}
                <SummaryRow
                  label="Dummy ticket"
                  value={form.getValues("dummyTicketRequired") ? "Yes" : "No"}
                />
                <SummaryRow
                  label="Visa required"
                  value={form.getValues("visaRequired") ? "Yes" : "No"}
                />
                <SummaryRow
                  label="Hotel required"
                  value={form.getValues("hotelRequired") ? "Yes" : "No"}
                />
                {form.getValues("hotelRequired") &&
                  form.getValues("hotelLocationPreference") && (
                    <SummaryRow
                      label="Hotel location"
                      value={
                        HOTEL_LOCATION_PREFERENCE_LABELS[
                          form.getValues("hotelLocationPreference")!
                        ]
                      }
                    />
                  )}
                {form.getValues("hotelRequired") &&
                  form.getValues("preferredHotel") && (
                    <SummaryRow
                      label="Preferred hotel"
                      value={form.getValues("preferredHotel")}
                    />
                  )}
                {form.getValues("hotelRequired") &&
                  form.getValues("hotelDetails") && (
                    <SummaryRow
                      label="Hotel details"
                      value={form.getValues("hotelDetails")}
                    />
                  )}
                {form.getValues("notes") && (
                  <SummaryRow label="Notes" value={form.getValues("notes")} />
                )}
              </div>
            )}

            <DialogFooter>
              {step === 1 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Review &amp; Submit</Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      "Confirm & Submit"
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
