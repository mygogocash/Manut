"use client";

import { Badge } from "@/components/shared/badge";
import {
  labelForInvestorTag,
  useInvestorTags,
  variantForInvestorTag,
} from "@/hooks/use-investor-tags";

interface InvestorTagChipsProps {
  codes: string[] | null | undefined;
  /** Chips rendered before collapsing the rest into "+N". */
  max?: number;
  className?: string;
}

/**
 * Tag row on an investor. Reads through the shared hook so labels and colours
 * follow whatever an admin last saved, and so a code whose tag was deleted
 * still renders (as its raw code) instead of vanishing.
 */
export function InvestorTagChips({
  codes,
  max = 2,
  className,
}: InvestorTagChipsProps) {
  // Subscribe to the cache so a freshly-loaded list re-renders the labels
  // instead of leaving raw codes on screen until the next interaction.
  useInvestorTags();

  if (!codes || codes.length === 0) return null;

  const shown = codes.slice(0, max);
  const hidden = codes.length - shown.length;

  return (
    <div
      className={`
        flex flex-wrap items-center gap-1
        ${className ?? ""}
      `}
    >
      {shown.map((code) => (
        <Badge key={code} variant={variantForInvestorTag(code)}>
          {labelForInvestorTag(code)}
        </Badge>
      ))}
      {hidden > 0 ? (
        // Native title so a collapsed row stays readable on hover — the
        // shared Badge takes no title prop of its own.
        <span title={codes.map(labelForInvestorTag).join(", ")}>
          <Badge variant="grey">+{hidden}</Badge>
        </span>
      ) : null}
    </div>
  );
}
