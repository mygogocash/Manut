/**
 * Temporary local GraphQL operation for the Manut handover inbox.
 *
 * Mirrors the codegen operation-object shape so this panel can ship alongside
 * the backend mutation before `@affine/graphql` has been regenerated.
 */

export interface ImportMnHandoverInput {
  handoverJson: string;
  targetDocId?: string;
}

export interface ImportMnHandoverResult {
  docId: string;
  title: string;
  updated: boolean;
}

export const importMnHandoverMutation = {
  id: 'importMnHandoverMutation' as const,
  op: 'importMnHandover',
  query: `mutation importMnHandover($workspaceId: String!, $input: ImportMnHandoverInput!) {
  importMnHandover(workspaceId: $workspaceId, input: $input) {
    docId
    title
    updated
  }
}`,
};
