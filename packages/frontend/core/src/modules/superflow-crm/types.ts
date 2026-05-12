/**
 * TypeScript types mirroring the Superflow CRM backend DTOs.
 *
 * These live in the frontend so the v0 panel can ship before
 * `@affine/graphql` has been regenerated. Keep them in lockstep with
 * `packages/backend/server/src/plugins/superflow/superflow-crm.dto.ts`.
 */

export type SfCrmActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'OTHER';

export const SF_CRM_ACTIVITY_TYPES: readonly SfCrmActivityType[] = [
  'NOTE',
  'CALL',
  'EMAIL',
  'MEETING',
  'OTHER',
] as const;

export interface SfCrmAccount {
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

export interface SfCrmContact {
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

export interface SfCrmDealStage {
  id: string;
  workspaceId: string;
  pipelineKey: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface SfCrmDeal {
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

export interface SfCrmActivity {
  id: string;
  workspaceId: string;
  accountId: string | null;
  contactId: string | null;
  dealId: string | null;
  type: SfCrmActivityType;
  subject: string | null;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSfCrmAccountInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export interface CreateSfCrmContactInput {
  accountId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
}

export interface CreateSfCrmDealStageInput {
  pipelineKey?: string | null;
  name: string;
  sortOrder?: number | null;
}

export interface CreateSfCrmDealInput {
  accountId?: string | null;
  contactId?: string | null;
  stageId: string;
  name: string;
  value?: number | null;
  currency?: string | null;
  probability?: number | null;
}

export interface CreateSfCrmActivityInput {
  accountId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  type: SfCrmActivityType;
  subject?: string | null;
  body?: string | null;
}
