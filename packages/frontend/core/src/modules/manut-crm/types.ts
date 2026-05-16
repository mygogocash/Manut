/**
 * TypeScript types mirroring the Manut CRM backend DTOs.
 *
 * These live in the frontend so the v0 panel can ship before
 * `@affine/graphql` has been regenerated. Keep them in lockstep with
 * `packages/backend/server/src/plugins/manut/manut-crm.dto.ts`.
 */

export type MnCrmActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'OTHER';

export const MN_CRM_ACTIVITY_TYPES: readonly MnCrmActivityType[] = [
  'NOTE',
  'CALL',
  'EMAIL',
  'MEETING',
  'OTHER',
] as const;

export interface MnCrmAccount {
  id: string;
  workspaceId: string;
  name: string;
  website: string | null;
  industry: string | null;
  notes: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MnCrmContact {
  id: string;
  workspaceId: string;
  accountId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MnCrmDealStage {
  id: string;
  workspaceId: string;
  pipelineKey: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface MnCrmDeal {
  id: string;
  workspaceId: string;
  accountId: string | null;
  contactId: string | null;
  stageId: string;
  name: string;
  value: number | null;
  currency: string | null;
  probability: number | null;
  expectedCloseAt: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MnCrmActivity {
  id: string;
  workspaceId: string;
  accountId: string | null;
  contactId: string | null;
  dealId: string | null;
  type: MnCrmActivityType;
  subject: string | null;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMnCrmAccountInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export interface CreateMnCrmContactInput {
  accountId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
}

export interface CreateMnCrmDealStageInput {
  pipelineKey?: string | null;
  name: string;
  sortOrder?: number | null;
}

export interface CreateMnCrmDealInput {
  accountId?: string | null;
  contactId?: string | null;
  stageId: string;
  name: string;
  value?: number | null;
  currency?: string | null;
  probability?: number | null;
}

export interface UpdateMnCrmDealInput {
  accountId?: string | null;
  contactId?: string | null;
  stageId?: string | null;
  name?: string | null;
  value?: number | null;
  currency?: string | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  ownerUserId?: string | null;
}

export interface CreateMnCrmActivityInput {
  accountId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  type: MnCrmActivityType;
  subject?: string | null;
  body?: string | null;
}

// Update inputs. Every field is optional — undefined leaves the column
// alone, an explicit `null` clears it. Matches the DTO shape in
// packages/backend/server/src/plugins/manut/manut-crm.dto.ts.

export interface UpdateMnCrmAccountInput {
  name?: string | null;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
  ownerUserId?: string | null;
}

export interface UpdateMnCrmContactInput {
  accountId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  ownerUserId?: string | null;
}

export interface UpdateMnCrmDealInput {
  accountId?: string | null;
  contactId?: string | null;
  stageId?: string | null;
  name?: string | null;
  value?: number | null;
  currency?: string | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  ownerUserId?: string | null;
}

export interface UpdateMnCrmActivityInput {
  type?: MnCrmActivityType;
  subject?: string | null;
  body?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
}
