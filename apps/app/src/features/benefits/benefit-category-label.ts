import type { BenefitCategory } from "@manut/app-core";

const LABELS: Record<BenefitCategory, string> = {
  health: "Health",
  dental: "Dental",
  vision: "Vision",
  life: "Life",
  retirement: "Retirement",
  wellness: "Wellness",
  other: "Other",
};

export function benefitCategoryLabel(category: BenefitCategory): string {
  return LABELS[category];
}
