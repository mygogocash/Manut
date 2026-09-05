---
type: Playbook
title: Global config block on a generated document
description: Store an org-wide, admin-editable block for a generated document as a single `SystemSetting` JSON row with a code-constant default, threaded into every export path.
tags: [backend, config, documents]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Global config block on a generated document

Payslip company footer.

## Shape

When a document (PDF/XLSX) needs an org-wide, admin-editable block with no
per-row variance, follow this shape.

## Steps

1. Store it as ONE `SystemSetting` row (`key: "payslip.company"`, JSON
   `value`) — no schema migration, no seed; `getX()` reads the row and falls
   back to a `DEFAULT_X` code constant when absent, so prod renders the
   default until an admin overrides. Type-guard every JSON field on read
   (`typeof v.phone === "string" ? … : DEFAULT.phone`). On upsert, write an
   **inline object literal** for `value` — a typed variable trips Prisma's
   `InputJsonValue`.
2. Gate read on an existing module perm (`PAYROLL_READ`), write on the admin
   perm (`PAYROLL_HR_ADMIN`); register the literal `/payslips/company` route
   BEFORE `/payslips/:id`.
3. Thread the block into EVERY export path (single PDF, single XLSX,
   bulk-zip `.map` — fetch once before the loop).
4. In the pdf-lib generator, render only when at least one field is set;
   greedy-`wrapText` the address to the content width; combine address + tel
   into one paragraph so the phone flows after the last line. Layout offsets
   are pure constants in `payslip-generator.ts` — tweak `cy` to re-space, no
   data change. pdf-lib Flate-compresses content streams, so footer text is
   NOT grep-able in saved bytes — verify by exporting, not byte-matching.
5. Admin edits via a Manage dialog (`payslip-company-dialog.tsx`) on the
   management tab.

## Reference

`payroll.service.ts` `getPayslipCompany()`/`setPayslipCompany()`;
`payslip-generator.ts` footer block; `payslip-company-dialog.tsx`.
