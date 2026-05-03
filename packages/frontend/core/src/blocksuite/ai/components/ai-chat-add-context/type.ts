import type {
  SearchCollectionMenuAction,
  SearchDocMenuAction,
  SearchTagMenuAction,
} from '@affine/core/modules/search-menu/services';
import type { LinkedMenuGroup } from '@blocksuite/affine/widgets/linked-doc';

export interface MentionMember {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}

export type SearchMemberMenuAction = (
  member: MentionMember
) => Promise<void> | void;

export interface SearchMenuConfig {
  getDocMenuGroup: (
    query: string,
    action: SearchDocMenuAction,
    abortSignal: AbortSignal
  ) => LinkedMenuGroup;
  getTagMenuGroup: (
    query: string,
    action: SearchTagMenuAction,
    abortSignal: AbortSignal
  ) => LinkedMenuGroup;
  getCollectionMenuGroup: (
    query: string,
    action: SearchCollectionMenuAction,
    abortSignal: AbortSignal
  ) => LinkedMenuGroup;
  // Optional - for @-mention people picker. Implementations that don't
  // provide this simply won't show the People section.
  getMemberMenuGroup?: (
    query: string,
    action: SearchMemberMenuAction,
    abortSignal: AbortSignal
  ) => LinkedMenuGroup;
}
