export const ALL_FILTER = "__all__";

export const CATEGORIES = [
  { value: "health", label: "Health" },
  { value: "dental", label: "Dental" },
  { value: "vision", label: "Vision" },
  { value: "life", label: "Life" },
  { value: "retirement", label: "Retirement" },
  { value: "wellness", label: "Wellness" },
  { value: "other", label: "Other" },
] as const;

export function formatCurrency(cost: string, currency: string) {
  return `${Number(cost).toLocaleString()} ${currency}/yr`;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
