/**
 * @vitest-environment node
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const DEPLOY_WORKFLOWS = [
  {
    branch: "preview",
    envName: "preview",
    path: ".github/workflows/deploy-preview.yml",
    wranglerCommand: "wrangler deploy --env preview",
  },
  {
    branch: "staging",
    envName: "staging",
    path: ".github/workflows/deploy-staging.yml",
    wranglerCommand: "wrangler deploy --env staging",
  },
] as const;

function requireStep(source: string): string {
  const match = source.match(
    /name:\s*Require[^\n]+\n([\s\S]*?)(?=\n\s+- name:|\njobs:|$)/u,
  );
  if (!match?.[1]) {
    throw new Error(
      "Expected a Require-* fail-closed step in deploy workflow.",
    );
  }
  return match[1];
}

describe("deploy workflows > Cloudflare-oriented Expo public config", () => {
  it("leaves production deployment exclusively to Cloudflare Workers Builds", () => {
    expect(existsSync(join(repoRoot, ".github/workflows/deploy.yml"))).toBe(
      false,
    );
  });

  it.each(DEPLOY_WORKFLOWS)(
    "$path requires Cloudflare + EXPO_PUBLIC_API_URL only (no Supabase)",
    ({ path }) => {
      const source = readFileSync(join(repoRoot, path), "utf8");
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

  it.each(DEPLOY_WORKFLOWS)(
    "$path ensures Cloudflare queues + R2 exist before its wrangler step",
    ({ envName, path, wranglerCommand }) => {
      const source = readFileSync(join(repoRoot, path), "utf8");
      const ensureCommand = `node scripts/ensure-cloudflare-resources.mjs --env ${envName}`;
      const ensureIndex = source.indexOf(ensureCommand);
      const wranglerIndex = source.lastIndexOf(wranglerCommand);
      expect(ensureIndex).toBeGreaterThan(-1);
      expect(wranglerIndex).toBeGreaterThan(-1);
      expect(ensureIndex).toBeLessThan(wranglerIndex);
    },
  );

  it.each(DEPLOY_WORKFLOWS)(
    "$path retains push and workflow_dispatch triggers",
    ({ branch, path }) => {
      const source = readFileSync(join(repoRoot, path), "utf8");

      expect(source).toMatch(
        new RegExp(
          `^on:\\s*\\n\\s+push:\\s*\\n\\s+branches:\\s*\\[${branch}\\]`,
          "mu",
        ),
      );
      expect(source).toMatch(/^\s+workflow_dispatch:\s*$/mu);
    },
  );

  it("targets isolated preview and staging Worker environments", () => {
    const preview = readFileSync(
      join(repoRoot, ".github/workflows/deploy-preview.yml"),
      "utf8",
    );
    const staging = readFileSync(
      join(repoRoot, ".github/workflows/deploy-staging.yml"),
      "utf8",
    );

    expect(preview).toMatch(/wrangler deploy --env preview/u);
    expect(preview).not.toMatch(/versions upload/u);
    expect(staging).toMatch(/wrangler deploy --env staging/u);
    expect(staging).not.toMatch(/--env production/u);
    expect(preview).not.toMatch(/manut-intranet-edge-preview/u);
  });

  it("bootstraps required secrets atomically on the first isolated preview deploy", () => {
    const preview = readFileSync(
      join(repoRoot, ".github/workflows/deploy-preview.yml"),
      "utf8",
    );
    const requirePreview = requireStep(preview);

    for (const secretName of [
      "EDGE_SIGNING_KEY",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    ]) {
      expect(requirePreview).toContain(secretName);
    }
    expect(preview).toContain("--secrets-file");
    expect(preview).toContain("RUNNER_TEMP");
    expect(preview).toContain("umask 077");
    expect(preview).toMatch(/trap [^\n]*rm -f/iu);
  });
});
