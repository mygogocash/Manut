import { uniReactRoot } from '@affine/component';
import { AiLoginRequiredModal } from '@affine/core/components/affine/auth/ai-login-required';
import { FloatingAiChatAnchor } from '@affine/core/components/floating-ai-chat-anchor';
import { useResponsiveSidebar } from '@affine/core/components/hooks/use-responsive-siedebar';
import { KeyboardShortcutsAnchor } from '@affine/core/components/keyboard-shortcuts';
import { SWRConfigProvider } from '@affine/core/components/providers/swr-config-provider';
import { WorkspaceSideEffects } from '@affine/core/components/providers/workspace-side-effects';
import { AppContainer } from '@affine/core/desktop/components/app-container';
import { DocumentTitle } from '@affine/core/desktop/components/document-title';
import { WorkspaceDialogs } from '@affine/core/desktop/dialogs';
import { FirstRunExperience } from '@affine/core/modules/first-run';
import { KeyboardShortcutsOverlay } from '@affine/core/modules/keyboard-shortcuts-overlay';
import { PeekViewManagerModal } from '@affine/core/modules/peek-view';
import { QuotaCheck } from '@affine/core/modules/quota';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import type { PropsWithChildren } from 'react';

export const WorkspaceLayout = function WorkspaceLayout({
  children,
}: PropsWithChildren) {
  const currentWorkspace = useService(WorkspaceService).workspace;
  return (
    <SWRConfigProvider>
      <WorkspaceDialogs />

      {/* ---- some side-effect components ---- */}
      {currentWorkspace?.flavour !== 'local' ? (
        <QuotaCheck workspaceMeta={currentWorkspace.meta} />
      ) : null}
      <AiLoginRequiredModal />
      <WorkspaceSideEffects />
      <PeekViewManagerModal />
      <DocumentTitle />

      <WorkspaceLayoutInner>{children}</WorkspaceLayoutInner>
      {/* should show after workspace loaded */}
      {/* FIXME: wait for better ai, <WorkspaceAIOnboarding /> */}
      {/* Manut M2 E2.8 — `<AIIsland />` removed: the FloatingAiChatAnchor
          below is now the single AI launcher. The legacy island (lower
          sparkle dot routing to /chat) was redundant once the multi-tab
          chat panel shipped. Component file kept at
          desktop/components/ai-island/ for now; a follow-up R2 commit
          can delete it once nothing else imports it (current usage:
          this file only). */}
      {/* Epic E1.4 — slide-in chat surface, gated by `floating_ai_chat` flag.
          Component renders null when the flag is off, so unconditional
          mounting here is safe and keeps the workbench shell the single
          mount point for every /workspace/* route. */}
      <FloatingAiChatAnchor />
      <FirstRunExperience />
      <KeyboardShortcutsOverlay />
      {/* M2 E2.8 — Cmd+P quick switcher + Cmd+Shift+/ workspace
          shortcuts overlay. Co-mounted with the existing `?` cheat-
          sheet above; the two cover different audiences (editor
          shortcuts vs workspace shell shortcuts) and never bind to
          the same key combination. */}
      <KeyboardShortcutsAnchor />
      <uniReactRoot.Root />
    </SWRConfigProvider>
  );
};

/**
 * Wraps the workspace layout main router view
 */
const WorkspaceLayoutUIContainer = ({ children }: PropsWithChildren) => {
  const workbench = useService(WorkbenchService).workbench;
  const currentPath = useLiveData(
    LiveData.computed(get => {
      return get(workbench.basename$) + get(workbench.location$).pathname;
    })
  );
  useResponsiveSidebar();

  return (
    <AppContainer data-current-path={currentPath}>{children}</AppContainer>
  );
};
const WorkspaceLayoutInner = ({ children }: PropsWithChildren) => {
  return <WorkspaceLayoutUIContainer>{children}</WorkspaceLayoutUIContainer>;
};
