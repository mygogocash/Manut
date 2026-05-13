/**
 * Local GraphQL operation objects for the Superflow CRM v0 UI.
 *
 * Mirrors the codegen operation-object shape so the page can ship alongside
 * the backend resolvers before `@affine/graphql` has been regenerated.
 */

import type {
  CreateMnCrmAccountInput,
  CreateMnCrmActivityInput,
  CreateMnCrmContactInput,
  CreateMnCrmDealInput,
  CreateMnCrmDealStageInput,
  MnCrmAccount,
  MnCrmActivity,
  MnCrmContact,
  MnCrmDeal,
  MnCrmDealStage,
  UpdateMnCrmDealInput,
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

export const mnCrmAccountsQuery = {
  id: 'mnCrmAccountsQuery' as const,
  op: 'mnCrmAccounts',
  query: `query mnCrmAccounts($workspaceId: String!) {
  mnCrmAccounts(workspaceId: $workspaceId) {${ACCOUNT_FIELDS}}
}`,
};

export const mnCrmContactsQuery = {
  id: 'mnCrmContactsQuery' as const,
  op: 'mnCrmContacts',
  query: `query mnCrmContacts($workspaceId: String!) {
  mnCrmContacts(workspaceId: $workspaceId) {${CONTACT_FIELDS}}
}`,
};

export const mnCrmDealStagesQuery = {
  id: 'mnCrmDealStagesQuery' as const,
  op: 'mnCrmDealStages',
  query: `query mnCrmDealStages($workspaceId: String!) {
  mnCrmDealStages(workspaceId: $workspaceId) {${DEAL_STAGE_FIELDS}}
}`,
};

export const mnCrmDealsQuery = {
  id: 'mnCrmDealsQuery' as const,
  op: 'mnCrmDeals',
  query: `query mnCrmDeals($workspaceId: String!) {
  mnCrmDeals(workspaceId: $workspaceId) {${DEAL_FIELDS}}
}`,
};

export const mnCrmActivitiesQuery = {
  id: 'mnCrmActivitiesQuery' as const,
  op: 'mnCrmActivities',
  query: `query mnCrmActivities($workspaceId: String!) {
  mnCrmActivities(workspaceId: $workspaceId) {${ACTIVITY_FIELDS}}
}`,
};

// Mutations ----------------------------------------------------------------

export const createMnCrmAccountMutation = {
  id: 'createMnCrmAccountMutation' as const,
  op: 'createMnCrmAccount',
  query: `mutation createMnCrmAccount($workspaceId: String!, $input: CreateMnCrmAccountInput!) {
  createMnCrmAccount(workspaceId: $workspaceId, input: $input) {${ACCOUNT_FIELDS}}
}`,
};

export const createMnCrmContactMutation = {
  id: 'createMnCrmContactMutation' as const,
  op: 'createMnCrmContact',
  query: `mutation createMnCrmContact($workspaceId: String!, $input: CreateMnCrmContactInput!) {
  createMnCrmContact(workspaceId: $workspaceId, input: $input) {${CONTACT_FIELDS}}
}`,
};

export const createMnCrmDealStageMutation = {
  id: 'createMnCrmDealStageMutation' as const,
  op: 'createMnCrmDealStage',
  query: `mutation createMnCrmDealStage($workspaceId: String!, $input: CreateMnCrmDealStageInput!) {
  createMnCrmDealStage(workspaceId: $workspaceId, input: $input) {${DEAL_STAGE_FIELDS}}
}`,
};

export const createMnCrmDealMutation = {
  id: 'createMnCrmDealMutation' as const,
  op: 'createMnCrmDeal',
  query: `mutation createMnCrmDeal($workspaceId: String!, $input: CreateMnCrmDealInput!) {
  createMnCrmDeal(workspaceId: $workspaceId, input: $input) {${DEAL_FIELDS}}
}`,
};

export const updateMnCrmDealMutation = {
  id: 'updateMnCrmDealMutation' as const,
  op: 'updateMnCrmDeal',
  query: `mutation updateMnCrmDeal($dealId: ID!, $input: UpdateMnCrmDealInput!) {
  updateMnCrmDeal(dealId: $dealId, input: $input) {${DEAL_FIELDS}}
}`,
};

export const createMnCrmActivityMutation = {
  id: 'createMnCrmActivityMutation' as const,
  op: 'createMnCrmActivity',
  query: `mutation createMnCrmActivity($workspaceId: String!, $input: CreateMnCrmActivityInput!) {
  createMnCrmActivity(workspaceId: $workspaceId, input: $input) {${ACTIVITY_FIELDS}}
}`,
};

// Response shapes ----------------------------------------------------------

export interface MnCrmAccountsResponse {
  mnCrmAccounts: MnCrmAccount[];
}

export interface MnCrmContactsResponse {
  mnCrmContacts: MnCrmContact[];
}

export interface MnCrmDealStagesResponse {
  mnCrmDealStages: MnCrmDealStage[];
}

export interface MnCrmDealsResponse {
  mnCrmDeals: MnCrmDeal[];
}

export interface MnCrmActivitiesResponse {
  mnCrmActivities: MnCrmActivity[];
}

export interface CreateMnCrmAccountResponse {
  createMnCrmAccount: MnCrmAccount;
}

export interface CreateMnCrmContactResponse {
  createMnCrmContact: MnCrmContact;
}

export interface CreateMnCrmDealStageResponse {
  createMnCrmDealStage: MnCrmDealStage;
}

export interface CreateMnCrmDealResponse {
  createMnCrmDeal: MnCrmDeal;
}

export interface UpdateMnCrmDealResponse {
  updateMnCrmDeal: MnCrmDeal;
}

export interface CreateMnCrmActivityResponse {
  createMnCrmActivity: MnCrmActivity;
}

// Variable shapes ----------------------------------------------------------

export interface MnCrmListQueryVars {
  workspaceId: string;
}

export interface CreateMnCrmAccountVars {
  workspaceId: string;
  input: CreateMnCrmAccountInput;
}

export interface CreateMnCrmContactVars {
  workspaceId: string;
  input: CreateMnCrmContactInput;
}

export interface CreateMnCrmDealStageVars {
  workspaceId: string;
  input: CreateMnCrmDealStageInput;
}

export interface CreateMnCrmDealVars {
  workspaceId: string;
  input: CreateMnCrmDealInput;
}

export interface UpdateMnCrmDealVars {
  dealId: string;
  input: UpdateMnCrmDealInput;
}

export interface CreateMnCrmActivityVars {
  workspaceId: string;
  input: CreateMnCrmActivityInput;
}
