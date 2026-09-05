import { z } from "zod";

import { CHAIN_SCOPES } from "@/modules/approval-chains/chain.types";

// Request validation for approval chain configuration.
//
// `approverUserId` is a uuid because it names a user. Nullable AND optional, and
// the two mean different things: `null` clears the approver, an absent key leaves
// it alone. Collapsing them would make "unassign this stage" impossible.

export const chainScopeParamSchema = z.object({
  scope: z.enum(CHAIN_SCOPES),
});

export const chainUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const chainStepCreateSchema = z.object({
  name: z.string().trim().min(1, "A stage name is required").max(100),
  description: z.string().trim().max(500).nullable().optional(),
  approverUserId: z.string().uuid().nullable().optional(),
});

export const chainStepUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  approverUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const chainReorderSchema = z.object({
  // Must be the whole chain, exactly once each. The service checks it against
  // the stored set; this only bounds the payload.
  orderedIds: z.array(z.string().uuid()).min(1).max(20),
});
