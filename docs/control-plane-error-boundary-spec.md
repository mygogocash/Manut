# Control Plane Settings Error Boundary

GOAL: Opening Settings > Control Plane Roles should never replace the whole
workspace with the global 500 screen when a control-plane GraphQL request
fails.

SCOPE IN:

- General settings Control Plane Roles panel.
- SWR suspense errors from roles, agents, approvals, skills, plugins, and org
  changes subtabs.
- Inline retryable error state.

SCOPE OUT:

- Changing the underlying control-plane backend schema or migrations.
- Reworking the control-plane tab layout or feature availability rules.

RISKS:

- R2: frontend-only containment for a failing settings panel. Reversible by
  reverting this commit.
- The fallback must reset when switching subtabs or retrying, otherwise a
  transient failed request can leave the panel stuck.

TESTS:

- `Control Plane roles setting panel > renders a local control-plane error instead of bubbling query failures`

VERIFICATION:

- `yarn vitest run packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/integration/control-plane-roles/__tests__/setting-panel.spec.tsx`
- `yarn eslint --no-cache packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/integration/control-plane-roles/setting-panel.tsx packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/integration/control-plane-roles/setting-panel.css.ts packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/integration/control-plane-roles/__tests__/setting-panel.spec.tsx`
- `yarn affine bundle -p web`

ROLLBACK:

- `git revert <commit>` and redeploy the previous image.
