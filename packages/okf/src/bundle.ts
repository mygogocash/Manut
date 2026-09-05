import fs from "fs";
import path from "path";

import { parseFrontmatter } from "./frontmatter";

/** `packages/okf/src` -> repo root -> `docs/okf`. */
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const BUNDLE_ROOT = path.join(REPO_ROOT, "docs", "okf");

export const RESERVED_FILENAMES = ["index.md", "log.md"] as const;

export function listMarkdownFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out.sort();
}

export function isReserved(absolutePath: string): boolean {
  return (RESERVED_FILENAMES as readonly string[]).includes(path.basename(absolutePath));
}

/** Concept id = bundle-relative path minus `.md`, POSIX separators, leading slash. */
export function toConceptId(absolutePath: string, root: string = BUNDLE_ROOT): string {
  const rel = path.relative(root, absolutePath).split(path.sep).join("/");
  return `/${rel.replace(/\.md$/, "")}`;
}

export interface BundleDocument {
  absolutePath: string;
  conceptId: string;
  frontmatter: Record<string, unknown> | null;
  body: string;
}

export function readDocument(absolutePath: string): BundleDocument {
  const source = fs.readFileSync(absolutePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(source);
  return {
    absolutePath,
    conceptId: toConceptId(absolutePath),
    frontmatter,
    body,
  };
}

export function listConceptDocuments(root: string = BUNDLE_ROOT): BundleDocument[] {
  return listMarkdownFiles(root)
    .filter((file) => !isReserved(file))
    .map(readDocument);
}
