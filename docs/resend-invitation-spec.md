# Resend Workspace Invitation

GOAL: Workspace owners/admins can resend an email invitation from Settings > Members for pending invite rows.

SCOPE IN:

- Backend GraphQL mutation for resending one pending email invitation.
- Existing invitation notification queue path.
- Members settings row menu action and success/error feedback.
- Focused backend e2e coverage for resending pending invitations.

SCOPE OUT:

- Changing invite-link behavior.
- Resending accepted members, under-review link requests, or team seat allocation notices.
- Bulk resend, scheduling, or analytics.

RISKS:

- R1: this touches an email-sending workflow and a public GraphQL mutation. The change is reversible by reverting this commit and redeploying the previous image.
- The mutation must reject stale/non-pending invite IDs so accepted members do not get duplicate invite emails.

STEPS:

1. Add a failing e2e test: `workspace invitation resend > given pending email invite > then queues another invitation email`.
2. Add the backend mutation with the same `Workspace.Users.Manage` permission gate used by invite/revoke.
3. Add the GraphQL client operation and workspace member store/service method.
4. Add the pending-row menu action and notification strings.
5. Run focused e2e, lint, typecheck/bundle gates, then commit.

VERIFICATION:

- `yarn workspace @affine/server e2e src/__tests__/e2e/workspace/member.spec.ts --match='workspace invitation resend*'`
- `yarn eslint --no-cache <touched ts/tsx files>`
- `yarn affine bundle -p @affine/server`
- `yarn affine bundle -p web`

ROLLBACK:

- `git revert <commit>` and redeploy the previous production image if the resend flow misbehaves.
