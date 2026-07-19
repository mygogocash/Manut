# Cost-model gate sign-off

**Status:** Not signed  
**Rule:** Empty/null approvals mean the workbook is **not** Phase 2 evidence.

Do not invent signatures, dates, or “provisional pass” language. When Finance and
Product approve a commit, fill this file and record the SHA in the release
record alongside generated `report.*` and `contribution-margin.*`.

## Approvals

| Role | Name | Date (ISO) | Commit SHA | Decision |
| ---- | ---- | ---------- | ---------- | -------- |
| Platform Engineering (usage formulas) | _pending_ | — | — | — |
| Finance (price, tax, labor, CM) | _pending_ | — | — | — |
| Product (plan mix, quotas, ceiling) | _pending_ | — | — | — |

## Checklist before any “approved” stamp

- [ ] `rates.yaml` source URLs and effective dates are real (not `TBD`)
- [ ] `scenarios.yaml` mix matches the sales forecast (not a silent blend)
- [ ] Measured Low/Base/High percentiles replace scaffold drivers where claimed
- [ ] All-Starter / approved-mix / all-Growth infra-ratio results are attached
- [ ] CM1/CM2/runway numbers use documented loaded labor treatment (§3.5)
- [ ] No claim that the standard offer exceeds 6,000 THB/year without product decision

## Related issues

Ops/product trackers that must stay honest while this workbook matures:
[#230](https://github.com/mygogocash/Manut/issues/230)–[#239](https://github.com/mygogocash/Manut/issues/239)
(umbrella [#239](https://github.com/mygogocash/Manut/issues/239)).
