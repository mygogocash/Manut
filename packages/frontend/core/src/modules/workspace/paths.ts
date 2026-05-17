import type { WorkspaceMetadata } from './metadata';

export function slugifyWorkspaceName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return slug.length > 0 ? slug : 'workspace';
}

export function getWorkspacePathSegment(
  workspaceId: string,
  workspaces: readonly WorkspaceMetadata[]
): string {
  const meta = workspaces.find(workspace => workspace.id === workspaceId);
  return meta?.slug ?? workspaceId;
}

export function resolveWorkspaceMetadataByKey(
  key: string,
  workspaces: readonly WorkspaceMetadata[]
): WorkspaceMetadata | undefined {
  return workspaces.find(
    workspace => workspace.id === key || workspace.slug === key
  );
}

export function buildWorkspacePath(
  workspaceId: string,
  workspaces: readonly WorkspaceMetadata[],
  subpath = ''
): string {
  const segment = getWorkspacePathSegment(workspaceId, workspaces);
  const suffix = subpath.startsWith('/')
    ? subpath
    : subpath
      ? `/${subpath}`
      : '';
  return `/workspace/${segment}${suffix}`;
}

export function replaceWorkspaceKeyInPathname(
  pathname: string,
  workspaceId: string,
  workspaces: readonly WorkspaceMetadata[]
): string | null {
  const segment = getWorkspacePathSegment(workspaceId, workspaces);
  const prefix = `/workspace/${workspaceId}`;
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  return `/workspace/${segment}${pathname.slice(prefix.length)}`;
}
