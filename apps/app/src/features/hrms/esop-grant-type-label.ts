import type { EsopGrantType } from "@manut/app-core";

/**
 * Human-readable label for an ESOP grant type.
 * Keep copy product-facing; avoid leaking import/source jargon.
 */
export function esopGrantTypeLabel(grantType: EsopGrantType): string {
  // TODO(contributor): map each EsopGrantType to the wording HR uses in
  // contracts (see web ESOP_GRANT_TYPE_LABELS). Default below is a safe
  // underscore→space fallback until that map lands.
  switch (grantType) {
    case "equity":
      return "Equity";
    case "tokens":
      return "Tokens";
    case "sign_up_bonus":
      return "Sign-up bonus";
    case "executive_equity":
      return "Executive equity";
    case "retention":
      return "Retention";
    case "annual_review":
      return "Annual review";
    case "performance_bonus":
      return "Performance bonus";
    case "advisory":
      return "Advisory";
    case "other":
      return "Other";
    default: {
      const _exhaustive: never = grantType;
      return _exhaustive;
    }
  }
}
