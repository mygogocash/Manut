# Contribution margin evidence (PLACEHOLDER)

**status:** `placeholder`  
**finance_signoff:** `null`  
**master plan:** §3.5  
**generated_by note:** Scaffold; `scripts/generate-cost-model-report.mjs` may refresh timestamps but must keep `finance_signoff: null`.

> No CM1/CM2 numbers are claimed. Engineering labor must not be treated as zero
> by omission. Finance/Product choose loaded hours by role **or** a funded
> annual maintenance reserve before any gate stamp.

## Accounting contract (to be filled)

```text
net recognized revenue
  = recognized subscription revenue excluding pass-through VAT/tax
  - refunds, credits, chargebacks, and expected bad debt

CM1
  = net recognized revenue
  - Cloudflare/EAS/domain/backup and other allocated infrastructure
  - email/SMS/AI and other provider usage
  - payment or marketplace fees
  - directly attributable onboarding, customer-success, support, and on-call labor

CM2
  = CM1
  - allocated recurring maintenance, release, security, compliance, and upgrade engineering
```

## Stop/go thresholds (reference only — not evaluated here)

| Gate | Threshold |
| ---- | --------- |
| Before Phase 2 / first paid external tenant | Every offered plan Base CM1-positive; approved 12-month mix CM1 ≥ 20%, CM2 ≥ 0, ≥ 12 months funded runway |
| Before Phase 12 GA | Trailing-90-day pilot CM1 ≥ 30%, CM2 ≥ 10%, CAC+onboarding payback ≤ 12 months |
| At 100 organizations (operating target) | CM1 ≥ 50%, CM2 ≥ 20% |

## Fields required before sign-off

- [ ] Plan mix, tax treatment, loaded labor rates
- [ ] Minutes/incidents per tenant assumptions
- [ ] Acquisition/onboarding spend
- [ ] Engineering allocation vs one-time migration spend
- [ ] Sensitivity analysis
- [ ] Owner approvals + source commit SHA in [`SIGN-OFF.md`](./SIGN-OFF.md)

## Related issues

[#236](https://github.com/mygogocash/Manut/issues/236) (product scope),
[#239](https://github.com/mygogocash/Manut/issues/239) (ops/product umbrella).
