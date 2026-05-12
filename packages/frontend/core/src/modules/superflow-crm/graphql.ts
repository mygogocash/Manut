/**
 * Local GraphQL operation objects for the Superflow CRM v0 UI.
 *
 * Mirrors the codegen operation-object shape so the page can ship alongside
 * the backend resolvers before `@affine/graphql` has been regenerated.
 */

import type {
  CreateSfCrmAccountInput,
  CreateSfCrmActivityInput,
  CreateSfCrmContactInput,
  CreateSfCrmDealInput,
  CreateSfCrmDealStageInput,
  SfCrmAccount,
  SfCrmActivity,
  SfCrmContact,
  SfCrmDeal,
  SfCrmDealStage,
} from './types';

const ACCOUNT_FIELDS = `
  id
  workspaceId
  name
  website
  industry
  notes
  ownerUserId
  createdAt
  updatedAt
`;

const CONTACT_FIELDS = `
  id
  workspaceId
  accountId
  firstName
  lastName
  email
  phone
  title
  ownerUserId
  createdAt
  updatedAt
`;

const DEAL_STAGE_FIELDS = `
  id
  workspaceId
  pipelineKey
  name
  sortOrder
  createdAt
`;

const DEAL_FIELDS = `
  id
  workspaceId
  accountId
  contactId
  stageId
  name
  value
  currency
  probability
  expectedCloseAt
  ownerUserId
  createdAt
  updatedAt
`;

const ACTIVITY_FIELDS = `
  id
  workspaceId
  accountId
  contactId
  dealId
  type
  subject
  body
  dueAt
  completedAt
  createdByUserId
  createdAt
  updatedAt
`;

// Queries -------------------------------------------------------------------

export const sfCrmAccountsQuery = {
  id: 'sfCrmAccountsQuery' as const,
  op: 'sfCrmAccounts',
  query: `query sfCrmAccounts($workspaceId: String!) {
  sfCrmAccounts(workspaceId: $workspaceId) {${ACCOUNT_FIELDS}}
}`,
};

export const sfCrmContactsQuery = {
  id: 'sfCrmContactsQuery' as const,
  op: 'sfCrmContacts',
  query: `query sfCrmContacts($workspaceId: String!) {
  sfCrmContacts(workspaceId: $workspaceId) {${CONTACT_FIELDS}}
}`,
};

export const sfCrmDealStagesQuery = {
  id: 'sfCrmDealStagesQuery' as const,
  op: 'sfCrmDealStages',
  query: `query sfCrmDealStages($workspaceId: String!) {
  sfCrmDealStages(workspaceId: $workspaceId) {${DEAL_STAGE_FIELDS}}
}`,
};

export const sfCrmDealsQuery = {
  id: 'sfCrmDealsQuery' as const,
  op: 'sfCrmDeals',
  query: `query sfCrmDeals($workspaceId: String!) {
  sfCrmDeals(workspaceId: $workspaceId) {${DEAL_FIELDS}}
}`,
};

export const sfCrmActivitiesQuery = {
  id: 'sfCrmActivitiesQuery' as const,
  op: 'sfCrmActivities',
  query: `query sfCrmActivities($workspaceId: String!) {
  sfCrmActivities(workspaceId: $workspaceId) {${ACTIVITY_FIELDS}}
}`,
};

// Mutations ----------------------------------------------------------------

export const createSfCrmAccountMutation = {
  id: 'createSfCrmAccountMutation' as const,
  op: 'createSfCrmAccount',
  query: `mutation createSfCrmAccount($workspaceId: String!, $input: CreateSfCrmAccountInput!) {
  createSfCrmAccount(workspaceId: $workspaceId, input: $input) {${ACCOUNT_FIELDS}}
}`,
};

export const createSfCrmContactMutation = {
  id: 'createSfCrmContactMutation' as const,
  op: 'createSfCrmContact',
  query: `mutation createSfCrmContact($workspaceId: String!, $input: CreateSfCrmContactInput!) {
  createSfCrmContact(workspaceId: $workspaceId, input: $input) {${CONTACT_FIELDS}}
}`,
};

export const createSfCrmDealStageMutation = {
  id: 'createSfCrmDealStageMutation' as const,
  op: 'createSfCrmDealStage',
  query: `mutation createSfCrmDealStage($workspaceId: String!, $input: CreateSfCrmDealStageInput!) {
  createSfCrmDealStage(workspaceId: $workspaceId, input: $input) {${DEAL_STAGE_FIELDS}}
}`,
};

export const createSfCrmDealMutation = {
  id: 'createSfCrmDealMutation' as const,
  op: 'createSfCrmDeal',
  query: `mutation createSfCrmDeal($workspaceId: String!, $input: CreateSfCrmDealInput!) {
  createSfCrmDeal(workspaceId: $workspaceId, input: $input) {${DEAL_FIELDS}}
}`,
};

export const createSfCrmActivityMutation = {
  id: 'createSfCrmActivityMutation' as const,
  op: 'createSfCrmActivity',
  query: `mutation createSfCrmActivity($workspaceId: String!, $input: CreateSfCrmActivityInput!) {
  createSfCrmActivity(workspaceId: $workspaceId, input: $input) {${ACTIVITY_FIELDS}}
}`,
};

// Response shapes ----------------------------------------------------------

export interface SfCrmAccountsResponse {
  sfCrmAccounts: SfCrmAccount[];
}

export interface SfCrmContactsResponse {
  sfCrmContacts: SfCrmContact[];
}

export interface SfCrmDealStagesResponse {
  sfCrmDealStages: SfCrmDealStage[];
}

export interface SfCrmDealsResponse {
  sfCrmDeals: SfCrmDeal[];
}

export interface SfCrmActivitiesResponse {
  sfCrmActivities: SfCrmActivity[];
}

export interface CreateSfCrmAccountResponse {
  createSfCrmAccount: SfCrmAccount;
}

export interface CreateSfCrmContactResponse {
  createSfCrmContact: SfCrmContact;
}

export interface CreateSfCrmDealStageResponse {
  createSfCrmDealStage: SfCrmDealStage;
}

export interface CreateSfCrmDealResponse {
  createSfCrmDeal: SfCrmDeal;
}

export interface CreateSfCrmActivityResponse {
  createSfCrmActivity: SfCrmActivity;
}

// Variable shapes ----------------------------------------------------------

export interface SfCrmListQueryVars {
  workspaceId: string;
}

export interface CreateSfCrmAccountVars {
  workspaceId: string;
  input: CreateSfCrmAccountInput;
}

export interface CreateSfCrmContactVars {
  workspaceId: string;
  input: CreateSfCrmContactInput;
}

export interface CreateSfCrmDealStageVars {
  workspaceId: string;
  input: CreateSfCrmDealStageInput;
}

export interface CreateSfCrmDealVars {
  workspaceId: string;
  input: CreateSfCrmDealInput;
}

export interface CreateSfCrmActivityVars {
  workspaceId: string;
  input: CreateSfCrmActivityInput;
}
