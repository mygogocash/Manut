# Repository migration record

> **Historical record.** Sole forward roadmap:
> [`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`](./EXPO_CLOUDFLARE_MASTER_PLAN.md).
> Provenance below does not define target runtime or phase schedule.

## Provenance

- Legacy Manut parent: `eb797d30b538a60b5f4ff154863a6591ed2ad62f`
- Audited source tree: `371349fd43fd7c7c7717054beec97bfb023885ca`
- Archive branch: `archive/affine-2026-07-16`
- Annotated archive tag: `affine-before-intranet-2026-07-16`

The replacement branch keeps the legacy Manut tip as its parent and imports only
the sanitized source tree. No source `.git` directory, commit history, generated
output, cache, local environment, or Playwright storage state is imported.
The replacement checkout has only the Manut Git remote configured; the audited
source repository is not retained as a fetch or push destination.

## Backup verification

A full bare mirror was created outside the working tree at
`Developer/backups/Manut-2026-07-17.git`. `git fsck --full` completed without an
error. The mirror contains 257,677 packed objects, and its `main` ref resolves to
the legacy parent SHA above.

The archive branch and annotated tag exist in the local replacement checkout and
resolve to the same legacy SHA. Remote publication and repository verification
remain required before merge.

## External ownership and revocation evidence

No provider credential is committed as evidence. Before merge, the pull request
must link to provider-side audit records showing that inherited credentials were
revoked and fail a negative authentication check, while replacement resources
are owned by Manut. This applies to database/auth, Google, GitHub OIDC,
the retired DocuSign integration, Railway, analytics, AI/email, Expo/EAS, and
Cloudflare resources. DocuSign runtime, OAuth/settings, webhook, provider
selection, and admin UI code is removed from the replacement tree; any
previously issued DocuSign credential still requires provider-side revocation
and a negative authentication check. Local provider CLIs expose only
pre-existing account contexts; none
is identified as the required fresh Manut organization. They were inspected
read-only and were not used to create, mutate, deploy, sign, or build anything.
Verified fresh Manut authority and provider-side revocation remain merge
blockers.

## Deployment boundary

The inherited production and staging deployment workflows are retained only as
`.disabled` documentation. This branch must not deploy an application, mutate a
database, change DNS, or modify the currently running `manut.xyz` service.
Cloudflare and mobile release enablement require a separately reviewed change.

## Rollback

1. Stop before merge if any provenance, secret, migration, E2E, or `Validate`
   check fails.
2. To inspect or rebuild the prior source, create a temporary branch from the
   archive branch or annotated tag; never reactivate its deployment workflows.
3. If the replacement commit has merged but no deployment was enabled, revert
   it through a reviewed pull request. The running service remains unaffected.
4. If a later cutover has occurred, follow that cutover's environment-specific
   rollback plan; this source archive is not a deployment lane.
