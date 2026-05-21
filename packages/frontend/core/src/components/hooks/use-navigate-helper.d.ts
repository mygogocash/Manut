import type { SettingTab } from '@affine/core/modules/dialogs/constant';
import { type WorkspaceMetadata } from '@affine/core/modules/workspace';
import type { DocMode } from '@blocksuite/affine/model';
import type { NavigateFunction, NavigateOptions } from 'react-router-dom';
/**
 * In workbench, we use nested react-router, so default `useNavigate` can't get correct navigate function in workbench.
 * We use this context to provide navigate function for whole app.
 */
export declare const NavigateContext: import("react").Context<NavigateFunction | null>;
export declare enum RouteLogic {
    REPLACE = "replace",
    PUSH = "push"
}
export type WorkspaceSettingsRouteOptions = {
    tab?: SettingTab;
    scrollAnchor?: string;
};
export declare function buildWorkspaceSettingsPath(workspaceId: string, workspaces?: readonly WorkspaceMetadata[], options?: WorkspaceSettingsRouteOptions): string;
export declare function buildWorkspaceSettingsRedirectUri(currentHref: string, workspaces?: readonly WorkspaceMetadata[], options?: WorkspaceSettingsRouteOptions): string;
/**
 * Use this for over workbench navigate, for navigate in workbench, use `WorkbenchService`.
 */
export declare function useNavigateHelper(): {
    jumpToPage: (workspaceId: string, pageId: string, logic?: RouteLogic) => void;
    jumpToPageBlock: (workspaceId: string, pageId: string, mode?: DocMode, blockIds?: string[], elementIds?: string[], logic?: RouteLogic) => void;
    jumpToPageComment: (workspaceId: string, pageId: string, commentId: string, mode: DocMode, logic?: RouteLogic) => void;
    jumpToIndex: (logic?: RouteLogic, opt?: {
        search?: string;
    }) => void;
    jumpTo404: (logic?: RouteLogic) => void;
    openPage: (workspaceId: string, pageId: string, logic?: RouteLogic) => void;
    jumpToExpired: (logic?: RouteLogic) => void;
    jumpToSignIn: (redirectUri?: string, logic?: RouteLogic, otherOptions?: Omit<NavigateOptions, "replace">, params?: Record<string, string>) => void;
    jumpToCollection: (workspaceId: string, collectionId: string, logic?: RouteLogic) => void;
    jumpToCollections: (workspaceId: string, logic?: RouteLogic) => void;
    jumpToTags: (workspaceId: string, logic?: RouteLogic) => void;
    jumpToTag: (workspaceId: string, tagId: string, logic?: RouteLogic) => void;
    jumpToOpenInApp: (url: string, newTab?: boolean) => void;
    jumpToImportTemplate: (name: string, snapshotUrl: string) => void;
    jumpToWorkspaceSettings: (workspaceId: string, options?: WorkspaceSettingsRouteOptions | SettingTab, logic?: RouteLogic) => void;
};
//# sourceMappingURL=use-navigate-helper.d.ts.map