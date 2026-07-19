#!/usr/bin/env node
/**
 * Cost-model report generator (scaffold).
 *
 * Reads docs/architecture/cost-model/{rates,scenarios}.yaml and writes
 * placeholder report.md / report.json / contribution-margin.* stamps.
 * Never sets finance_signoff or status: approved — humans own SIGN-OFF.md.
 *
 * Full unit-rate math lands when Platform Engineering replaces TBD rates and
 * measured drivers; this script only keeps the artifact contract honest.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "docs", "architecture", "cost-model");

function readYamlText(name) {
  return readFileSync(join(dir, name), "utf8");
}

function extractPlanPrices(ratesText) {
  const starter = /starter:\s*(\d+)/.exec(ratesText)?.[1] ?? "3000";
  const growth = /growth:\s*(\d+)/.exec(ratesText)?.[1] ?? "6000";
  return { starter: Number(starter), growth: Number(growth), ceiling: 6000 };
}

const ratesText = readYamlText("rates.yaml");
const scenariosText = readYamlText("scenarios.yaml");
const prices = extractPlanPrices(ratesText);

const generatedAt = new Date().toISOString();
const relatedIssues = [230, 231, 232, 233, 234, 235, 236, 237, 238, 239];

const reportJson = {
  status: "placeholder",
  finance_signoff: null,
  generated_at: generatedAt,
  generated_by: "scripts/generate-cost-model-report.mjs",
  commercial_envelope_thb_per_org_year: prices,
  inputs: {
    rates_bytes: ratesText.length,
    scenarios_bytes: scenariosText.length,
    measured_pilot_commit_sha: null,
  },
  infrastructure: {
    computed: false,
    reason:
      "Scaffold only — rates/sources TBD; no fake pass/fail totals",
  },
  gates: {
    orgs_30_max_infra_share: 0.47,
    orgs_100_target_infra_share: 0.3,
    base_variable_plus_ai_max_thb_per_org_month_at_30: 75,
    high_variable_plus_ai_max_thb_per_org_month_unless_growth_funds: 175,
    results: null,
  },
  related_issues: relatedIssues,
};

const cmJson = {
  status: "placeholder",
  finance_signoff: null,
  generated_at: generatedAt,
  computed: false,
  cm1: null,
  cm2: null,
  payback_months: null,
  runway_months: null,
  related_issues: [236, 239],
};

const reportMd = `# Cost-model infrastructure report (PLACEHOLDER)

**status:** \`placeholder\`
**finance_signoff:** \`null\`
**generated_at:** \`${generatedAt}\`
**generated_by:** \`scripts/generate-cost-model-report.mjs\`

> Regenerated scaffold. Not Finance/Product evidence. See \`SIGN-OFF.md\`.

## Commercial envelope

| Plan | Annual list price |
| ---- | ----------------: |
| Starter | ${prices.starter} THB |
| Growth | ${prices.growth} THB |

Ceiling: **${prices.ceiling} THB**/org/year for the standard offer.

## Infrastructure ratio computation

**Not computed.** Fill dated rates and measured scenarios, then extend this
script with reviewed formulas. Gate reminders remain in
\`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md\` §3.4.

## Related issues

${relatedIssues.map((n) => `#${n}`).join(", ")}
`;

const cmMd = `# Contribution margin evidence (PLACEHOLDER)

**status:** \`placeholder\`
**finance_signoff:** \`null\`
**generated_at:** \`${generatedAt}\`

No CM1/CM2 figures are emitted by the scaffold generator. Complete labor and
mix assumptions per §3.5, then extend formulas under human review.
`;

writeFileSync(join(dir, "report.json"), `${JSON.stringify(reportJson, null, 2)}\n`);
writeFileSync(join(dir, "report.md"), reportMd);
writeFileSync(
  join(dir, "contribution-margin.json"),
  `${JSON.stringify(cmJson, null, 2)}\n`,
);
writeFileSync(join(dir, "contribution-margin.md"), cmMd);

console.log(
  "Wrote placeholder cost-model artifacts (finance_signoff=null). See docs/architecture/cost-model/SIGN-OFF.md.",
);
