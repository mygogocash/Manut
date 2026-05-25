# Mobile AI Chat Function Spec

## Requirement

The mobile workspace home screen must provide a functional Manut AI entry point with mobile-safe colors, spacing, and controls.

## Observed Failure

The mobile Ask AI sheet renders a textarea and action buttons, but the send button is permanently disabled and no message handler is wired. This makes the primary mobile AI entry point look available while being non-functional.

## Intended Behavior

- Tapping the mobile `Ask AI` dock button opens a bottom sheet that uses the same `AIChatContent` runtime as the desktop chat surfaces.
- The chat composer can create a Copilot session and send messages through the existing provider/model pipeline.
- The sheet keeps mobile color tokens for the surface, icons, overlay, and safe-area spacing.
- AI document links opened from the mobile chat route through the mobile workbench.
- Closing and reopening the sheet does not leave duplicate chat elements mounted.

## Edge Cases

- Workspaces without an existing document should not throw while mounting the chat host.
- A closed sheet must not consume pointer events or keep duplicate Lit chat content in the DOM.
- Mobile dark and light themes should inherit existing AFFiNE/Manut CSS variables instead of hard-coded desktop colors.
- Existing desktop chat and floating chat behavior must stay unchanged.

## Testing Strategy

- `mobile workspace home > given Ask AI is opened > then the sheet mounts AIChatContent instead of the disabled mock composer`
- Focused static verification: the mobile panel no longer renders a disabled send button and configures `createSession` for `AIChatContent`.
- Focused formatting/linting on the mobile home source and styles.
- Production log verification after deploy for app-owned AI/chat errors.

Risk: R2. This is a mobile frontend entry-point repair using the existing AI chat runtime and service wiring.

Rollback: revert this spec plus the mobile home source/style changes.
