import type { WorkspaceMetadata } from './metadata';
export declare function slugifyWorkspaceName(name: string): string;
export declare function getWorkspacePathSegment(workspaceId: string, workspaces: readonly WorkspaceMetadata[]): string;
export declare function resolveWorkspaceMetadataByKey(key: string, workspaces: readonly WorkspaceMetadata[]): WorkspaceMetadata | undefined;
export declare function buildWorkspacePath(workspaceId: string, workspaces: readonly WorkspaceMetadata[], subpath?: string): string;
export declare function replaceWorkspaceKeyInPathname(pathname: string, workspaceId: string, workspaces: readonly WorkspaceMetadata[]): string | null;
//# sourceMappingURL=paths.d.ts.map