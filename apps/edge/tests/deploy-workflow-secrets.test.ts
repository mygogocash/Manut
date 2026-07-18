/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const DEPLOY_WORKFLOWS = [
  ".github/workflows/deploy.yml",
  ".github/workflows/deploy-preview.yml",
  ".github/workflows/deploy-staging.yml",
] as const;

function requireStep(source: string): string {
  const match = source.match(
    /name:\s*Require[^\n]+\n([\s\S]*?)(?=\n\s+- name:|\njobs:|$)/u,
  );
  if (!match?.[1]) {
    throw new Error("Expected a Require-* fail-closed step in deploy workflow.");
  }
  return match[1];
}

describe("deploy workflows > Cloudflare-oriented Expo public config", () => {
  it.each(DEPLOY_WORKFLOWS)(
    "%s requires Cloudflare + EXPO_PUBLIC_API_URL only (no Supabase)",
    (relativePath) => {
      const source = readFileSync(join(repoRoot, relativePath), "utf8");
      const step = requireStep(source);

      expect(step).toContain("CLOUDFLARE_API_TOKEN");
      expect(step).toContain("CLOUDFLARE_ACCOUNT_ID");
      expect(step).toContain("EXPO_PUBLIC_API_URL");
      expect(step).not.toMatch(/EXPO_PUBLIC_SUPABASE_/u);
      expect(step).not.toMatch(/require EXPO_PUBLIC_SUPABASE_/u);

      expect(source).not.toMatch(
        /Export universal web app[\s\S]*EXPO_PUBLIC_SUPABASE_/u,
      );
    },
  );

  it("targets Worker service manut for production deploy and preview upload", () => {
    const production = readFileSync(
      join(repoRoot, ".github/workflows/deploy.yml"),
      "utf8",
    );
    const preview = readFileSync(
      join(repoRoot, ".github/workflows/deploy-preview.yml"),
      "utf8",
    );
    const staging = readFileSync(
      join(repoRoot, ".github/workflows/deploy-staging.yml"),
      "utf8",
    );

    expect(production).toMatch(/wrangler deploy --env production/u);
    expect(preview).toMatch(/wrangler versions upload --env preview/u);
    expect(staging).toMatch(/wrangler deploy --env staging/u);
    expect(production).not.toMatch(/manut-intranet-edge-production/u);
    expect(preview).not.toMatch(/manut-intranet-edge-preview/u);
  });
});
