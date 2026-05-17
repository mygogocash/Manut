import type { WorkspaceMetadata } from '@affine/core/modules/workspace';
import { buildWorkspacePath } from '@affine/core/modules/workspace';

export const WORKSPACE_ROUTE_PATH = '/workspace/:workspaceId/*';
export const SHARE_ROUTE_PATH = '/share/:workspaceId/:pageId';
export const NOT_FOUND_ROUTE_PATH = '/404';
export const CATCH_ALL_ROUTE_PATH = '*';

export function getWorkspaceDocPath(
  workspaceId: string,
  docId: string,
  workspaces: readonly WorkspaceMetadata[] = []
) {
  return buildWorkspacePath(workspaceId, workspaces, `/${docId}`);
}
