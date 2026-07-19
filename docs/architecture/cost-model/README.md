# Cost model workbook (canonical)

**Status:** Scaffold / placeholders only  
**Commercial envelope:** Starter **3,000 THB/org/year**, Growth **6,000 THB/org/year**  
**Master plan:** `docs/EXPO_CLOUDFLARE_MASTER_PLAN.md` §3.3–3.5, Epic 1.5

This directory is the auditable cost workbook described in the master plan.
It is **not** Finance/Product sign-off and must not be cited as Phase 2
production-commitment evidence until:

1. Platform Engineering fills usage formulas from measured pilot percentiles.
2. Finance/Product fills price/margin/labor assumptions and records approvals.
3. Both approve an immutable git commit SHA for the gate package.

## Layout

| Path | Owner draft | Contents |
| ---- | ----------- | -------- |
| `rates.yaml` | Platform Engineering | Dated unit rates, currency, tax/fee treatment, source URLs |
| `scenarios.yaml` | Platform + Product | Starter/Growth mix; Low/Base/High per-org drivers (§3.4) |
| `report.md` / `report.json` | Generated | Infrastructure affordability vs mix gates (§3.4) |
| `contribution-margin.md` / `.json` | Generated + Finance | CM1/CM2/payback/runway (§3.5) |
| `SIGN-OFF.md` | Finance/Product | Explicit approval record (empty until signed) |

Generate placeholders (or regenerate after editing YAML):

```bash
node scripts/generate-cost-model-report.mjs
```

The generator refuses to emit `status: approved`. It always stamps
`finance_signoff: null` until humans edit `SIGN-OFF.md` and pin a SHA.

## Gates (reminder — do not invent pass/fail)

From §3.4–3.5 (paraphrased):

- Base variable infra + included AI ≤ **75 THB/org/month** at 30 orgs; High ≤ **175 THB** unless Growth funds it.
- Total infrastructure ≤ **47%** of the **actual** forecast mix revenue at 30 orgs; target ≤ **30%** at 100 orgs (before labor).
- Run **all-Starter**, **approved mix**, and **all-Growth** separately.
- Before Phase 2 / first paid external tenant: every offered plan Base CM1-positive; approved 12-month mix CM1 ≥ 20%, CM2 ≥ 0, ≥ 12 months funded runway.
- Standard annual offer ceiling remains **6,000 THB**; raising it needs an explicit product decision.

## Related issues

- Umbrella: [#239](https://github.com/mygogocash/Manut/issues/239)
- Product scope affecting included modules/quotas: [#236](https://github.com/mygogocash/Manut/issues/236)
- Preview topology needed before measured load inputs are honest: [#230](https://github.com/mygogocash/Manut/issues/230), [#233](https://github.com/mygogocash/Manut/issues/233)
- WfP $25/month fixed fee confirmation lives in Epic 1.5 checklist (links back here)

P0 auth/data items [#231](https://github.com/mygogocash/Manut/issues/231), [#234](https://github.com/mygogocash/Manut/issues/234), [#235](https://github.com/mygogocash/Manut/issues/235) and CI [#237](https://github.com/mygogocash/Manut/issues/237) are not cost-model math, but they gate a trustworthy pilot.
