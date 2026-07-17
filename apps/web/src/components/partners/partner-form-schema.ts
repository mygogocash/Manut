import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1, "Contact name is required").max(200),
  title: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  isPrimary: z.boolean(),
});

export const partnerFormSchema = z
  .object({
    company: z.string().min(1, "Company name is required").max(300),
    type: z.string().min(1, "Type is required"),
    status: z.string().min(1),
    region: z.string().max(100).optional().or(z.literal("")),
    country: z.string().max(100).optional().or(z.literal("")),
    website: z.string().url("Invalid URL").optional().or(z.literal("")),
    description: z.string().max(5000).optional().or(z.literal("")),
    contractValue: z.string().optional().or(z.literal("")),
    contractStart: z.string().optional().or(z.literal("")),
    contractEnd: z.string().optional().or(z.literal("")),
    notes: z.string().max(5000).optional().or(z.literal("")),
    // Projects-style roll-out tracking fields (#534). Empty strings
    // are converted back to nulls in the form submit handler.
    productionLiveDate: z.string().optional().or(z.literal("")),
    goLiveDate: z.string().optional().or(z.literal("")),
    revisedGoLiveDate: z.string().optional().or(z.literal("")),
    dependency: z.string().max(200).optional().or(z.literal("")),
    comment: z.string().max(1000).optional().or(z.literal("")),
    department: z.string().optional().or(z.literal("")),
    ownerId: z.string().optional().or(z.literal("")),
    contacts: z.array(contactSchema),
  })
  .refine(
    (data) => {
      const a = data.contractStart?.trim();
      const b = data.contractEnd?.trim();
      if (!a || !b) return true;
      return b >= a;
    },
    {
      message: "Contract end must not be before contract start",
      path: ["contractEnd"],
    },
  );

export type PartnerFormValues = z.infer<typeof partnerFormSchema>;

export const PARTNER_FORM_DEFAULTS: PartnerFormValues = {
  company: "",
  type: "",
  status: "prospect",
  region: "",
  country: "",
  website: "",
  description: "",
  contractValue: "",
  contractStart: "",
  contractEnd: "",
  notes: "",
  productionLiveDate: "",
  goLiveDate: "",
  revisedGoLiveDate: "",
  dependency: "",
  comment: "",
  department: "",
  ownerId: "",
  contacts: [],
};
