/** URL slug: `{company-slug}-{partnerId}` — unique via the cuid suffix. */
export function slugifyPartnerName(company: string): string {
  const base = company
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || "partner";
}

export function buildPartnerSlug(company: string, id: string): string {
  return `${slugifyPartnerName(company)}-${id}`;
}
