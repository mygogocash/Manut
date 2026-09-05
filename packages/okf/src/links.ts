import fs from "fs";
import path from "path";

import { BUNDLE_ROOT, isReserved, listMarkdownFiles, readDocument, toConceptId } from "./bundle";

const FENCE = /^```/;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/**
 * Walk a markdown body line by line, skipping fenced code blocks, and yield
 * every markdown link target found. Shared by the bundle-absolute and
 * relative link extractors so the fence-skipping logic can't drift between
 * them.
 */
function* walkLinkTargets(body: string): Generator<string> {
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line.matchAll(MARKDOWN_LINK)) {
      yield match[1]!;
    }
  }
}

/**
 * Bundle-absolute link targets (`/patterns/foo.md`) found in a body.
 *
 * Fenced code blocks are skipped: the bundle documents its own link syntax in
 * examples, and those illustrative links point at concepts that do not exist.
 */
export function extractBundleLinks(body: string): string[] {
  const out: string[] = [];
  for (const target of walkLinkTargets(body)) {
    if (target.startsWith("/")) out.push(target);
  }
  return out;
}

/** Matches a URL scheme prefix (`https:`, `mailto:`, `tel:`, `data:`, …). */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Relative link targets found in a body — `./foo.md`, `../patterns/foo.md`,
 * and the bare sibling form `foo.md` (no leading `./` or `../`, the most
 * idiomatic relative spelling and the one GitHub renders correctly).
 *
 * The plan requires cross-links to be bundle-absolute, never relative,
 * because a relative link is stable only until the referencing document
 * moves. A relative target is a policy violation regardless of whether it
 * would happen to resolve — it is reported separately from
 * {@link extractBundleLinks} rather than silently ignored.
 *
 * Implemented as an inverted test rather than an enumeration of relative
 * spellings, so a form this hasn't been taught yet still gets caught: a
 * target is relative unless it is bundle-absolute (`/…`), a bare anchor
 * (`#…`), or carries a URL scheme (detected generically via {@link
 * URL_SCHEME}, not an allowlist of known schemes — so `tel:` and `data:`
 * are excluded exactly like `https:` and `mailto:` without needing to be
 * named).
 */
export function extractRelativeLinks(body: string): string[] {
  const out: string[] = [];
  for (const target of walkLinkTargets(body)) {
    const trimmed = target.trim();
    if (trimmed.startsWith("/")) continue;
    if (trimmed.startsWith("#")) continue;
    if (URL_SCHEME.test(trimmed)) continue;
    out.push(target);
  }
  return out;
}

export interface BrokenLink {
  from: string;
  to: string;
}

export function findBrokenLinks(root: string = BUNDLE_ROOT): BrokenLink[] {
  const broken: BrokenLink[] = [];
  for (const file of listMarkdownFiles(root)) {
    const doc = readDocument(file);
    const from = toConceptId(file, root);
    for (const target of extractBundleLinks(doc.body)) {
      const withoutAnchor = target.split("#")[0]!;
      if (withoutAnchor === "") continue;
      // Use path.resolve with a relative path prefix so that .. segments are resolved
      // relative to the bundle root instead of the filesystem root. However, path.resolve
      // still yields absolute paths (e.g., /etc/passwd for /../../../etc/passwd), so the
      // containedIn check is what actually rejects paths that escape the bundle.
      const resolved = path.resolve(root, `.${withoutAnchor}`);
      const containedIn = resolved === root || resolved.startsWith(root + path.sep);
      if (!containedIn || !fs.existsSync(resolved)) {
        broken.push({ from, to: target });
      }
    }
  }
  return broken;
}

export interface RelativeLinkViolation {
  from: string;
  to: string;
}

/**
 * Every relative link target (`./…`, `../…`, or the bare sibling form) used
 * anywhere in the bundle.
 *
 * The plan mandates bundle-absolute links; a relative link bypasses link
 * integrity entirely because {@link findBrokenLinks} never resolves it. This
 * is reported as its own gate, distinct from {@link findBrokenLinks}, so the
 * failure names the violation as "must be bundle-absolute" rather than
 * "missing".
 */
export function findRelativeLinks(root: string = BUNDLE_ROOT): RelativeLinkViolation[] {
  const violations: RelativeLinkViolation[] = [];
  for (const file of listMarkdownFiles(root)) {
    const doc = readDocument(file);
    const from = toConceptId(file, root);
    for (const target of extractRelativeLinks(doc.body)) {
      violations.push({ from, to: target });
    }
  }
  return violations;
}

export interface UnreachableDocument {
  section: string;
  file: string;
}

/**
 * Concept documents that exist and are manifest-claimed but are not linked
 * from their own section's `index.md` — i.e. unreachable via the
 * progressive-disclosure path an agent is routed through.
 *
 * {@link findBrokenLinks} only checks index → document (that a link
 * resolves); this checks the reverse, document → index, for each of
 * `pitfalls/` and `patterns/`. A document link integrity can't catch is not
 * "missing" in the broken-link sense — it exists on disk — but it is
 * effectively unreachable, which for an agent-first bundle is close enough
 * to deleted to warrant its own gate.
 */
export function findUnreachableDocuments(root: string = BUNDLE_ROOT): UnreachableDocument[] {
  const unreachable: UnreachableDocument[] = [];
  for (const section of ["pitfalls", "patterns"]) {
    const sectionDir = path.join(root, section);
    if (!fs.existsSync(sectionDir)) continue;

    const indexPath = path.join(sectionDir, "index.md");
    const indexBody = fs.existsSync(indexPath) ? readDocument(indexPath).body : "";
    const linked = new Set(extractBundleLinks(indexBody));

    for (const name of fs.readdirSync(sectionDir)) {
      const full = path.join(sectionDir, name);
      if (!name.endsWith(".md") || isReserved(full)) continue;
      if (!linked.has(`/${section}/${name}`)) {
        unreachable.push({ section, file: `${section}/${name}` });
      }
    }
  }
  return unreachable;
}
