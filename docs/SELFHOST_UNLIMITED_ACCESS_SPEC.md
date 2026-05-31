# Self-Host Unlimited Access Spec

## Requirement

Manut production runs with `/info.type = selfhosted` but keeps the GraphQL
cloud surface for workspace/admin UX. When payment is not enabled for that
server, GoGoCash must not see paid-resource gates:

- Pro AI models are selectable in the chat model picker.
- Stored Pro model selections are not reset back to Auto.
- Copilot action quota is unlimited.
- Monthly AI budget checks do not block chat requests.

AFFiNE Cloud behavior must stay unchanged when the Payment server feature is
enabled.

## Data Models And Gates

- `serverConfig.features` contains `Payment` only when Stripe/payment is active.
- `serverConfig.type` is currently hardcoded to `Affine` for Manut cloud UI.
- User Copilot quota is exposed through `QuotaService.getUserQuota`.
- AI budget enforcement is handled by `AiBudgetService.assertWithinCap`.
- Pro model rows are marked by `AIModel.isPro` from the prompt-models query.

## Edge Cases

- Payment enabled and no AI subscription: Pro models remain locked.
- Payment enabled and active AI subscription: Pro models remain selectable.
- Payment disabled: Pro models are selectable because there is no checkout path.
- Self-hosted backend deployment: quotas/budgets must not block internal usage.
- Unknown or missing workspace plan on cloud: keep existing Free-tier fallback.

## Testing Strategy

- Backend AVA tests:
  - `ai budget > given selfhosted deployment > then does not throw over free cap`
  - `quota > given selfhosted deployment > then copilot action limit is unlimited`
- Frontend Vitest tests:
  - `ai model access > given payment disabled > then pro model is not gated`
  - `ai model access > given payment enabled without subscription > then pro model is gated`
  - `ai model access > given payment enabled with active AI > then pro model is not gated`

## Task Plan

1. Add tests for the entitlement gates. R2. Rollback: delete tests and helpers.
2. Patch frontend model-access helper and model reset guard. R2. Rollback: restore subscription-only gate.
3. Patch backend self-host quota and AI budget guards. R1 because it affects usage limits. Rollback: restore Free/Pro tier enforcement.
4. Run focused tests and verify live `/info` plus `/graphql` server features.
