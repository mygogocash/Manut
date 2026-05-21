/**
 * Local GraphQL operation objects for the Manut CRM v0 UI.
 *
 * Mirrors the codegen operation-object shape so the page can ship alongside
 * the backend resolvers before `@affine/graphql` has been regenerated.
 */
import type { CreateMnCrmAccountInput, CreateMnCrmActivityInput, CreateMnCrmContactInput, CreateMnCrmDealInput, CreateMnCrmDealStageInput, MnCrmAccount, MnCrmActivity, MnCrmContact, MnCrmDeal, MnCrmDealStage, UpdateMnCrmAccountInput, UpdateMnCrmActivityInput, UpdateMnCrmContactInput, UpdateMnCrmDealInput } from './types';
export declare const mnCrmAccountsQuery: {
    id: "mnCrmAccountsQuery";
    op: string;
    query: string;
};
export declare const mnCrmContactsQuery: {
    id: "mnCrmContactsQuery";
    op: string;
    query: string;
};
export declare const mnCrmDealStagesQuery: {
    id: "mnCrmDealStagesQuery";
    op: string;
    query: string;
};
export declare const mnCrmDealsQuery: {
    id: "mnCrmDealsQuery";
    op: string;
    query: string;
};
export declare const mnCrmActivitiesQuery: {
    id: "mnCrmActivitiesQuery";
    op: string;
    query: string;
};
export declare const createMnCrmAccountMutation: {
    id: "createMnCrmAccountMutation";
    op: string;
    query: string;
};
export declare const createMnCrmContactMutation: {
    id: "createMnCrmContactMutation";
    op: string;
    query: string;
};
export declare const createMnCrmDealStageMutation: {
    id: "createMnCrmDealStageMutation";
    op: string;
    query: string;
};
export declare const createMnCrmDealMutation: {
    id: "createMnCrmDealMutation";
    op: string;
    query: string;
};
export declare const createMnCrmActivityMutation: {
    id: "createMnCrmActivityMutation";
    op: string;
    query: string;
};
export declare const updateMnCrmAccountMutation: {
    id: "updateMnCrmAccountMutation";
    op: string;
    query: string;
};
export declare const updateMnCrmContactMutation: {
    id: "updateMnCrmContactMutation";
    op: string;
    query: string;
};
export declare const updateMnCrmDealMutation: {
    id: "updateMnCrmDealMutation";
    op: string;
    query: string;
};
export declare const updateMnCrmActivityMutation: {
    id: "updateMnCrmActivityMutation";
    op: string;
    query: string;
};
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
export interface CreateMnCrmActivityResponse {
    createMnCrmActivity: MnCrmActivity;
}
export interface UpdateMnCrmAccountResponse {
    updateMnCrmAccount: MnCrmAccount;
}
export interface UpdateMnCrmContactResponse {
    updateMnCrmContact: MnCrmContact;
}
export interface UpdateMnCrmDealResponse {
    updateMnCrmDeal: MnCrmDeal;
}
export interface UpdateMnCrmActivityResponse {
    updateMnCrmActivity: MnCrmActivity;
}
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
export interface CreateMnCrmActivityVars {
    workspaceId: string;
    input: CreateMnCrmActivityInput;
}
export interface UpdateMnCrmAccountVars {
    accountId: string;
    input: UpdateMnCrmAccountInput;
}
export interface UpdateMnCrmContactVars {
    contactId: string;
    input: UpdateMnCrmContactInput;
}
export interface UpdateMnCrmDealVars {
    dealId: string;
    input: UpdateMnCrmDealInput;
}
export interface UpdateMnCrmActivityVars {
    activityId: string;
    input: UpdateMnCrmActivityInput;
}
//# sourceMappingURL=graphql.d.ts.map