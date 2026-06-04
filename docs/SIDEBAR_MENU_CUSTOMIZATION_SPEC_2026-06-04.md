# Executive Summary

Add a workspace-scoped left-sidebar customization layer so users can hide/show
and reorder the available sidebar menu entries from the existing Customize
popover.

# Business Goals

- Let each workspace owner reduce left-menu clutter without losing access to
  the Customize control.
- Make the Manut sidebar fit different team workflows: docs-heavy, sales/CRM,
  reminders, analytics, or AI-first.

# Technical Goals

- Reuse the existing root app sidebar and Customize popover.
- Persist preferences per workspace through `GlobalState`.
- Keep the default sidebar order unchanged for users with no preference.
- Avoid backend schema or database changes.

# Requirements

- The Customize popover lists all configurable sidebar menu entries, not only
  document sections.
- Each entry has a hide/show toggle.
- Each entry can move up or down in the sidebar order.
- Hidden entries disappear immediately from the left sidebar.
- Preferences survive reloads and are scoped by workspace id.
- Unknown/stale stored keys are ignored safely.

# Non-Goals

- Drag-and-drop reordering in v1.
- Custom labels, icons, permissions, or per-user role policy.
- New autonomous runtime or database table.

# Architecture

- Add a pure sidebar menu preference helper for normalization, toggle, reorder,
  and visible-item projection.
- Extend `section-visibility-editor.tsx` to edit full sidebar menu preferences.
- Render sidebar navigation/sections/utilities from keyed item arrays and apply
  the preference helper.

# Data Models

Preferences are stored in `GlobalState` as:

```ts
type SidebarMenuPreferences = {
  hidden?: SidebarMenuItemKey[];
  order?: SidebarMenuItemKey[];
};
```

Storage key: `sidebar.menuPreferences.${workspaceId}`.

# API Contracts

No backend or GraphQL changes.

# Security

- Client-side preference only; it does not bypass workspace permissions.
- Feature-gated Manut entries still render `null` when their backend feature is
  unavailable.

# Edge Cases

- Stale keys in storage are dropped.
- Duplicate order keys are collapsed.
- Missing order keys are appended in the default order.
- Moving the first item up or last item down is a no-op.
- Hiding all entries leaves the Customize row available.

# Testing Strategy

- Unit tests for preference normalization, hide/show toggles, reorder, and
  visible item ordering.
- Focused frontend lint/format checks for touched sidebar files.
- Bundle smoke with `yarn affine bundle -p web` when implementation compiles.

# Rollback Plan

Revert the sidebar preference helper and root sidebar render changes. Stored
preferences are inert if no code reads the key.

# Milestones

- Milestone 1: Preference helper and tests.
- Milestone 2: Customize popover supports hide/show and reorder for all menu
  items.
- Milestone 3: Sidebar renders filtered/reordered primary, section, and utility
  items.

# Epics

- Sidebar personalization: users can tailor the left navigation without admin
  settings.

# User Stories

As a workspace user, I want to hide menu items I do not use so that the sidebar
stays focused.

As a workspace user, I want to reorder menu items so that my most-used tools are
near the top.

# Tasks

- Add `sidebar-menu-customization.ts` helper and unit tests.
- Extend `SectionVisibilityEditor` into a full sidebar menu customization
  editor.
- Render keyed item arrays through the preference helper in `RootAppSidebar` and
  `HomeView`.

# Acceptance Criteria

- Default sidebar order remains unchanged when preferences are empty.
- Hiding `Analytics`, `Projects`, or a section removes it from the sidebar.
- Moving a menu item changes its render order.
- Preferences are workspace-scoped through `GlobalState`.
- Focused tests and formatting checks pass.
