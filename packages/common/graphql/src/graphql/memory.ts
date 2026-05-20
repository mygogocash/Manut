/**
 * Manut Wave 5 (M2 — E2.2) — "What AI knows about me" GraphQL client surface.
 *
 * The auto-generated `src/graphql/index.ts` and `src/schema.ts` are
 * rebuilt by `yarn workspace @affine/graphql build` from the .gql
 * source files (see ./memory/*.gql). On every codegen run these
 * exports also land in `index.ts` — the manual surface here is a
 * pre-codegen stand-in so the Settings panel compiles before the
 * generator catches up. After running codegen, the deep import below
 * will resolve to the codegen'd shapes via the package index.
 *
 * Per the project's gql convention, every operation is a
 * `GraphQLQuery` object with `{ id, op, query }`. The `id` is what
 * `useQuery`/`useMutation` key on; keep them stable so SWR caches
 * survive a regen.
 *
 * Memory type uses string-literal unions for `kind` and `scope`,
 * matching the backend `MemoryKind` / `MemoryScope` types in
 * plugins/copilot/memory/types.ts. GraphQL exposes them as
 * `MemoryKindEnum` / `MemoryScopeEnum` (see memory.resolver.ts) but
 * the wire format is still a string; the union is sufficient on the
 * client.
 */

import type { GraphQLQuery } from './index';

export type MemoryKind = 'FACT' | 'DECISION' | 'OBSERVATION' | 'PLAYBOOK';
export type MemoryScope = 'user' | 'workspace';

export interface MemoryEntity {
  __typename?: 'Memory';
  id: string;
  content: string;
  kind: MemoryKind;
  scope: MemoryScope;
  pinned: boolean;
  createdAt: string;
  workspaceId: string;
}

export interface MyMemoriesQueryVariables {
  workspaceId: string;
}

export interface MyMemoriesQuery {
  __typename?: 'Query';
  myMemories: MemoryEntity[];
}

export const myMemoriesQuery: GraphQLQuery = {
  id: 'myMemoriesQuery' as const,
  op: 'myMemories',
  query: `query myMemories($workspaceId: String!) {
  myMemories(workspaceId: $workspaceId) {
    id
    content
    kind
    scope
    pinned
    createdAt
    workspaceId
  }
}`,
};

export interface PinMemoryMutationVariables {
  id: string;
}

export interface PinMemoryMutation {
  __typename?: 'Mutation';
  pinMemory: MemoryEntity;
}

export const pinMemoryMutation: GraphQLQuery = {
  id: 'pinMemoryMutation' as const,
  op: 'pinMemory',
  query: `mutation pinMemory($id: ID!) {
  pinMemory(id: $id) {
    id
    content
    kind
    scope
    pinned
    createdAt
    workspaceId
  }
}`,
};

export interface ForgetMemoryMutationVariables {
  id: string;
}

export interface ForgetMemoryMutation {
  __typename?: 'Mutation';
  forgetMemory: boolean;
}

export const forgetMemoryMutation: GraphQLQuery = {
  id: 'forgetMemoryMutation' as const,
  op: 'forgetMemory',
  query: `mutation forgetMemory($id: ID!) {
  forgetMemory(id: $id)
}`,
};

export interface PromoteMemoryToWorkspaceMutationVariables {
  id: string;
}

export interface PromoteMemoryToWorkspaceMutation {
  __typename?: 'Mutation';
  promoteMemoryToWorkspace: MemoryEntity;
}

export const promoteMemoryToWorkspaceMutation: GraphQLQuery = {
  id: 'promoteMemoryToWorkspaceMutation' as const,
  op: 'promoteMemoryToWorkspace',
  query: `mutation promoteMemoryToWorkspace($id: ID!) {
  promoteMemoryToWorkspace(id: $id) {
    id
    content
    kind
    scope
    pinned
    createdAt
    workspaceId
  }
}`,
};
