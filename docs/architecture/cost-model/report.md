# Cost-model infrastructure report (PLACEHOLDER)

**status:** `placeholder`  
**finance_signoff:** `null`  
**generated_by:** `scripts/generate-cost-model-report.mjs`  
**source:** `rates.yaml` + `scenarios.yaml` scaffold from master plan §3.3–3.4

> This file is intentionally non-numeric for gate decisions. Do **not** treat
> any figure here as a pass/fail result. Re-run the generator after rates and
> measured scenarios are real; Finance/Product must still complete
> [`SIGN-OFF.md`](./SIGN-OFF.md).

## Commercial envelope (from plan list prices)

| Plan | Annual list price |
| ---- | ----------------: |
| Starter | 3,000 THB |
| Growth | 6,000 THB |

Ceiling: standard annual offer must not silently exceed **6,000 THB**.

## Cohort mixes (revenue only — infra spend TBD)

| Mix key | Orgs | Starter | Growth | Annual recognized subscription revenue |
| ------- | ---: | ------: | -----: | -------------------------------------: |
| all_starter_30 | 30 | 30 | 0 | 90,000 THB |
| approved_mix_placeholder_30 | 30 | 15 | 15 | 135,000 THB |
| all_growth_30 | 30 | 0 | 30 | 180,000 THB |
| scale_100_mix_placeholder | 100 | TBD | TBD | TBD |

## Infrastructure ratio computation

**Not computed.** Variable Cloudflare/EAS/SMS/AI/D1/R2/… unit math and the
fixed planning floor must be applied by a reviewed formula once `rates.yaml`
sources are dated and non-TBD.

Gate reminders (master plan §3.4):

- ≤ 47% of mix revenue at 30 orgs (before labor)
- target ≤ 30% at 100 orgs
- Base variable + AI ≤ 75 THB/org/month at 30 orgs
- High ≤ 175 THB/org/month unless Growth funds it

## Related issues

Measured inputs depend on preview topology honesty:
[#230](https://github.com/mygogocash/Manut/issues/230),
[#233](https://github.com/mygogocash/Manut/issues/233).
Product freeze: [#236](https://github.com/mygogocash/Manut/issues/236).
Umbrella: [#239](https://github.com/mygogocash/Manut/issues/239).
