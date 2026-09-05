import { ConflictException } from "@/common/exceptions/http-exception";

export function assertUniqueVendorTaxInvoice(opts: {
  vendorTaxInvoiceNo?: string | null;
  existingId?: string | null;
}): void {
  const no = opts.vendorTaxInvoiceNo?.trim();
  if (!no) return;
  if (opts.existingId) {
    throw new ConflictException(
      `Vendor tax invoice number "${no}" already exists for this vendor`,
    );
  }
}

export async function rejectDuplicateVendorTaxInvoice(opts: {
  vendorTaxInvoiceNo?: string | null;
  findExisting: () => Promise<{ id: string } | null>;
}): Promise<void> {
  const no = opts.vendorTaxInvoiceNo?.trim();
  if (!no) return;
  const existing = await opts.findExisting();
  assertUniqueVendorTaxInvoice({
    vendorTaxInvoiceNo: no,
    existingId: existing?.id ?? null,
  });
}
