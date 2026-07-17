import { Plus, Trash2 } from "lucide-react";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";

import type { PartnerFormValues } from "@/components/partners/partner-form-schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface PartnerContactFieldsProps {
  form: UseFormReturn<PartnerFormValues>;
  fieldArray: UseFieldArrayReturn<PartnerFormValues, "contacts">;
}

export function PartnerContactFields({
  form,
  fieldArray,
}: PartnerContactFieldsProps) {
  const { fields, append, remove } = fieldArray;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p
          className={`
            text-muted-foreground text-[10px] font-bold tracking-widest
            uppercase
          `}
        >
          Contacts
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() =>
            append({
              name: "",
              title: "",
              email: "",
              phone: "",
              isPrimary: false,
            })
          }
        >
          <Plus className="mr-1 size-3" />
          Add contact
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-xs">No contacts added yet.</p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className={`border-border flex flex-col gap-3 rounded-md border p-3`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Contact {index + 1}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(index)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name={`contacts.${index}.name`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...f} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`contacts.${index}.title`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CTO" {...f} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`contacts.${index}.email`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      {...f}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`contacts.${index}.phone`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+971 ..." {...f} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name={`contacts.${index}.isPrimary`}
            render={({ field: f }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox checked={f.value} onCheckedChange={f.onChange} />
                </FormControl>
                <FormLabel className="mt-0! text-xs">Primary contact</FormLabel>
              </FormItem>
            )}
          />
        </div>
      ))}
    </section>
  );
}
