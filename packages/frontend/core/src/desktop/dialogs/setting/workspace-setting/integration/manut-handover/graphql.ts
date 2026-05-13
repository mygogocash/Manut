/**
 * Temporary local GraphQL operation for the Superflow handover inbox.
 *
 * Mirrors the codegen operation-object shape so this panel can ship alongside
 * the backend mutation before `@affine/graphql` has been regenerated.
 */

export interface ImportSuperflowHandoverInput {
  handoverJson: string;
  targetDocId?: string;
}

export interface ImportSuperflowHandoverResult {
  docId: string;
  title: string;
  updated: boolean;
}

export const importSuperflowHandoverMutation = {
  id: 'importSuperflowHandoverMutation' as const,
  op: 'importSuperflowHandover',
  query: `mutation importSuperflowHandover($workspaceId: String!, $input: ImportSuperflowHandoverInput!) {
  importSuperflowHandover(workspaceId: $workspaceId, input: $input) {
    docId
    title
    updated
  }
}`,
};
