export { default as marketingRecapRoutes } from "@/modules/marketing-recap/marketing-recap.controller";
export {
  marketingRecapService,
  normalizeNotes,
  normalizeTargets,
  RECAP_NOTES_KEY_PREFIX,
  RECAP_TARGETS_KEY,
  type RecapNotes,
  type RecapTarget,
} from "@/modules/marketing-recap/marketing-recap.service";
