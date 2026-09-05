// Stage list comes from PRD §5/§11.4. Order matches the canonical pipeline
// progression so UI kanban columns can render directly off this constant.
// "live" sits after closed_won: a won deal that is now live / generating
// revenue (pairs with launchDate + revenueLaunchDate). Order matches the
// canonical kanban column order so the board renders directly off this.
export const OPPORTUNITY_STAGES = [
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "live",
  "closed_lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

// PRD §11.4 — opinionated probability defaults per stage. The service uses
// this map only when `probabilityCustom = false`; once a rep manually sets
// a probability we never overwrite it on stage moves.
export const STAGE_PROBABILITY_DEFAULTS: Record<OpportunityStage, number> = {
  qualified: 20,
  proposal: 40,
  negotiation: 60,
  closed_won: 100,
  // Live = already won, so 100% like closed_won.
  live: 100,
  closed_lost: 0,
};
