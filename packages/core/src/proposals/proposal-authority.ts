import { PERMISSIONS } from "@nexora/contracts";
import {
  isInFlight,
  type ProposalStatus,
  TERMINAL_STATUSES,
} from "@nexora/contracts/modules/proposals/proposal.types";

export const CAPABILITY = {
  CREATE: "create",
  VIEW: "view",
  EDIT: "edit",
  DECIDE: "decide",
  ASK_INFORMATION: "ask_information",
  PROVIDE_INFORMATION: "provide_information",
} as const;
export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];

const CAPABILITY_PERMISSION: Record<Capability, string | null> = {
  [CAPABILITY.CREATE]: PERMISSIONS.PROPOSALS_CREATE,
  [CAPABILITY.VIEW]: PERMISSIONS.PROPOSALS_READ,
  [CAPABILITY.EDIT]: PERMISSIONS.PROPOSALS_CREATE,
  [CAPABILITY.DECIDE]: null,
  [CAPABILITY.ASK_INFORMATION]: null,
  [CAPABILITY.PROVIDE_INFORMATION]: null,
};

export interface AuthorityContext {
  permissions: string[];
  status: ProposalStatus;
  isRequester?: boolean;
  isInformationAssignee?: boolean;
  canDecideStage?: boolean;
  isFirstStage?: boolean;
}

export interface AuthorityDecision {
  allowed: boolean;
  reason?: string;
}

function holds(ctx: AuthorityContext, code: string | null): boolean {
  if (code === null) return true;
  return (
    ctx.permissions.includes(code) ||
    ctx.permissions.includes(PERMISSIONS.PROJECTS_MANAGE)
  );
}

export function canDecideAtStage(ctx: AuthorityContext): boolean {
  if (!isInFlight(ctx.status)) return false;
  if (ctx.permissions.includes(PERMISSIONS.PROJECTS_MANAGE)) return true;
  return ctx.canDecideStage === true;
}

export function can(capability: Capability, ctx: AuthorityContext): AuthorityDecision {
  if (!holds(ctx, CAPABILITY_PERMISSION[capability])) {
    return { allowed: false, reason: "Your role does not permit this action" };
  }

  const terminal = TERMINAL_STATUSES.includes(ctx.status);

  switch (capability) {
    case CAPABILITY.CREATE:
    case CAPABILITY.VIEW:
      return { allowed: true };

    case CAPABILITY.EDIT:
      if (terminal) {
        return { allowed: false, reason: "This proposal has already been decided" };
      }
      if (!ctx.isFirstStage) {
        return {
          allowed: false,
          reason: "A proposal can only be edited before the first stage has decided",
        };
      }
      if (!ctx.isRequester) {
        return {
          allowed: false,
          reason: "Only the person who raised this proposal can edit it",
        };
      }
      return { allowed: true };

    case CAPABILITY.DECIDE:
      if (terminal) {
        return { allowed: false, reason: "This proposal has already been decided" };
      }
      return canDecideAtStage(ctx)
        ? { allowed: true }
        : {
            allowed: false,
            reason: "This stage of the approval chain is not yours to decide",
          };

    case CAPABILITY.ASK_INFORMATION:
      if (terminal) {
        return { allowed: false, reason: "This proposal has already been decided" };
      }
      return canDecideAtStage(ctx)
        ? { allowed: true }
        : {
            allowed: false,
            reason: "Only the reviewer at this stage can ask for information",
          };

    case CAPABILITY.PROVIDE_INFORMATION:
      return ctx.isInformationAssignee
        ? { allowed: true }
        : { allowed: false, reason: "This question was asked of someone else" };

    default:
      return { allowed: false, reason: "Unknown capability" };
  }
}
