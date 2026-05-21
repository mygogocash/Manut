export type { WorkspaceProfileInfo } from './entities/profile';
export { Workspace } from './entities/workspace';
export { WorkspaceEngineBeforeStart, WorkspaceInitialized } from './events';
export { getAFFiNEWorkspaceSchema } from './global-schema';
export type { WorkspaceMetadata } from './metadata';
export type { WorkspaceOpenOptions } from './open-options';
export { buildWorkspacePath, getWorkspacePathSegment, replaceWorkspaceKeyInPathname, resolveWorkspaceMetadataByKey, slugifyWorkspaceName, } from './paths';
export type { WorkspaceFlavourProvider } from './providers/flavour';
export { WorkspaceFlavoursProvider } from './providers/flavour';
export { WorkspaceLocalCache, WorkspaceLocalState } from './providers/storage';
export { WorkspaceScope } from './scopes/workspace';
export { WorkspaceService } from './services/workspace';
export { WorkspacesService } from './services/workspaces';
import type { Framework } from '@toeverything/infra';
export declare function configureWorkspaceModule(framework: Framework): void;
//# sourceMappingURL=index.d.ts.map