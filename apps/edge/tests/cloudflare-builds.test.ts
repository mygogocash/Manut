/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function productionWorkerName(wranglerSource: string): string | null {
  const productionBlock = wranglerSource.match(
    /"production"\s*:\s*\{([\s\S]*?)\n\s{4}\},?\n\s*\}/u,
  )?.[1];
  if (!productionBlock) return null;
  return productionBlock.match(/^\s*"name"\s*:\s*"([^"]+)"/mu)?.[1] ?? null;
}

describe("Cloudflare Workers Builds contract", () => {
  it("root package.json exposes build:cloudflare that generates Prisma then exports web (not turbo build)", () => {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    const script = pkg.scripts?.["build:cloudflare"];
    expect(script).toBeTruthy();
    expect(script).toContain("db:generate");
    expect(script).toContain("@manut/app");
    expect(script).toContain("export:web");
    expect(script).not.toMatch(/\bturbo\b/u);
  });

  it("wrangler production Worker name matches Cloudflare service manut", () => {
    const wrangler = readFileSync(
      join(repoRoot, "apps/edge/wrangler.jsonc"),
      "utf8",
    );
    expect(productionWorkerName(wrangler)).toBe("manut");
  });

  it("docs/CICD_CLOUDFLARE.md documents Workers Builds paste settings", () => {
    const doc = readFileSync(
      join(repoRoot, "docs/CICD_CLOUDFLARE.md"),
      "utf8",
    );
    expect(doc).toContain("build:cloudflare");
    expect(doc).toContain("wrangler deploy --env production");
    expect(doc).toMatch(/versions upload --env preview|wrangler deploy --env preview/u);
    expect(doc).toContain("24.18.0");
    expect(doc).toMatch(/Why `pnpm run build` fails/iu);
  });
});
