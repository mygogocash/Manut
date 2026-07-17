import type { UseFormReturn } from "react-hook-form";

import type { PartnerFormValues } from "@/components/partners/partner-form-schema";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import {
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
import type { AssignableUser } from "@/services/directory.service";
import {
  PARTNER_DEPARTMENT_OPTIONS,
  PARTNER_STATUS_LABELS,
  PARTNER_STATUSES,
  PARTNER_TYPE_LABELS,
  PARTNER_TYPES,
} from "@/services/partner.service";

interface PartnerCompanyFieldsProps {
  form: UseFormReturn<PartnerFormValues>;
}

interface PartnerTrackingFieldsProps extends PartnerCompanyFieldsProps {
  users: AssignableUser[];
}

export function PartnerCompanyFields({ form }: PartnerCompanyFieldsProps) {
  return (
    <section className="flex flex-col gap-3">
      <p
        className={`
          text-muted-foreground text-[10px] font-bold tracking-widest uppercase
        `}
      >
        Company info
      </p>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Company name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Acme Corp" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PARTNER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PARTNER_TYPE_LABELS[t]}
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
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PARTNER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PARTNER_STATUS_LABELS[s]}
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
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Region</FormLabel>
              <FormControl>
                <Input placeholder="e.g. MENA" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input placeholder="e.g. UAE" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Brief description of the partnership…"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}

export function PartnerContractFields({ form }: PartnerCompanyFieldsProps) {
  const contractStart = form.watch("contractStart");
  const contractEnd = form.watch("contractEnd");

  return (
    <section className="flex flex-col gap-3">
      <p
        className={`
          text-muted-foreground text-[10px] font-bold tracking-widest uppercase
        `}
      >
        Contract
      </p>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="contractValue"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Contract value (USD)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contractStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start date</FormLabel>
              <FormControl>
                <FormDatePicker
                  {...field}
                  maxDate={contractEnd?.trim() || undefined}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contractEnd"
          render={({ field }) => (
            <FormItem>
              <FormLabel>End date</FormLabel>
              <FormControl>
                <FormDatePicker
                  {...field}
                  minDate={contractStart?.trim() || undefined}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}

export function PartnerNotesField({ form }: PartnerCompanyFieldsProps) {
  return (
    <section className="flex flex-col gap-3">
      <p
        className={`
          text-muted-foreground text-[10px] font-bold tracking-widest uppercase
        `}
      >
        Notes
      </p>
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Textarea placeholder="Internal notes…" rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}

const TRACKING_OWNER_NONE = "__partner_owner_none__";
const TRACKING_DEPT_NONE = "__partner_dept_none__";

/**
 * Roll-out tracking section — mirrors the Projects edit dialog so the
 * Partner CRM list (#534) can render the same Production Live / Go
 * Live / Rev. Go Live / Dependency / Comment / Department / Owner
 * columns. All fields optional; empty strings convert back to nulls
 * in the dialog's submit handler.
 */
export function PartnerTrackingFields({
  form,
  users,
}: PartnerTrackingFieldsProps) {
  return (
    <section className="flex flex-col gap-3">
      <p
        className={`
          text-muted-foreground text-[10px] font-bold tracking-widest uppercase
        `}
      >
        Roll-out tracking
      </p>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="productionLiveDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Production Live</FormLabel>
              <FormControl>
                <FormDatePicker {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="goLiveDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GoLive Date</FormLabel>
              <FormControl>
                <FormDatePicker {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="revisedGoLiveDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Revised GoLive</FormLabel>
              <FormControl>
                <FormDatePicker {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dependency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dependency</FormLabel>
              <FormControl>
                <Input
                  placeholder="What's blocking go-live?"
                  maxLength={200}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department</FormLabel>
              <Select
                value={field.value ? field.value : TRACKING_DEPT_NONE}
                onValueChange={(v) =>
                  field.onChange(v === TRACKING_DEPT_NONE ? "" : v)
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={TRACKING_DEPT_NONE}>None</SelectItem>
                  {PARTNER_DEPARTMENT_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
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
          name="ownerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Owner</FormLabel>
              <Select
                // Key on user-count so Radix re-evaluates the
                // value→item match when the directory slice finishes
                // loading (avoids the "empty until reopen" bug the
                // employee form shipped in #572).
                key={`owner-${users.length}`}
                value={field.value ? field.value : TRACKING_OWNER_NONE}
                onValueChange={(v) =>
                  field.onChange(v === TRACKING_OWNER_NONE ? "" : v)
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={TRACKING_OWNER_NONE}>None</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
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
        name="comment"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Comment</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Roll-out status / context for the dashboard"
                rows={3}
                maxLength={1000}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
