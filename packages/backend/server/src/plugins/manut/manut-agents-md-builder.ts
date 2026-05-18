import yaml from 'js-yaml';

import type {
  AgentsMdAgent,
  AgentsMdDocument,
  AgentsMdGoal,
  AgentsMdSkill,
} from './manut-agents-md-parser';

/**
 * M5.2 — AGENTS.md builder. Inverse of `parseAgentsMd`.
 *
 * Round-trip contract: for any AgentsMdDocument `doc`,
 *
 *     parseAgentsMd(buildAgentsMd(doc))
 *
 * must be deep-equal to `doc` (modulo ordering of keys within the
 * top-level object — section order IS preserved). Tests in
 * m5b-agents-md-roundtrip.spec.ts pin this guarantee.
 *
 * The builder writes YAML frontmatter with the standard `---` fence,
 * uses `## Agent <name>` / `## Skill <slug>` / `## Goal <title>`
 * headers, and emits inner per-section frontmatter only when the
 * section actually carries metadata fields. Sections with no metadata
 * are emitted as a bare header plus body.
 */

const FRONTMATTER_FENCE = '---';

export function buildAgentsMd(doc: AgentsMdDocument): string {
  const parts: string[] = [];

  if (doc.frontmatter && Object.keys(doc.frontmatter).length > 0) {
    parts.push(emitFrontmatterBlock(doc.frontmatter));
  }

  for (const agent of doc.agents) {
    parts.push(emitAgent(agent));
  }
  for (const skill of doc.skills) {
    parts.push(emitSkill(skill));
  }
  for (const goal of doc.goals) {
    parts.push(emitGoal(goal));
  }

  // Join with a single blank line between sections, end with newline.
  return parts.filter(p => p.length > 0).join('\n\n') + '\n';
}

function emitFrontmatterBlock(fm: Record<string, unknown>): string {
  const body = yaml.dump(fm, { lineWidth: -1, noRefs: true }).trimEnd();
  return `${FRONTMATTER_FENCE}\n${body}\n${FRONTMATTER_FENCE}`;
}

function emitAgent(agent: AgentsMdAgent): string {
  const header = `## Agent ${agent.name}`;
  const inner: Record<string, unknown> = {};
  if (agent.role !== undefined) inner.role = agent.role;
  if (agent.adapter !== undefined) inner.adapter = agent.adapter;
  if (agent.capabilities !== undefined) inner.capabilities = agent.capabilities;
  if (agent.skills !== undefined && agent.skills.length > 0)
    inner.skills = agent.skills;

  const description = agent.description?.trim() ?? '';
  return assembleSection(header, inner, description);
}

function emitSkill(skill: AgentsMdSkill): string {
  const header = `## Skill ${skill.slug}`;
  const inner: Record<string, unknown> = {};
  // `name` is always written so parseSkill can read it back even when
  // the parser would otherwise default to slug. This makes the
  // round-trip exact for skills whose name differs from slug.
  inner.name = skill.name;
  if (skill.version !== undefined) inner.version = skill.version;
  return assembleSection(header, inner, skill.body.trim());
}

function emitGoal(goal: AgentsMdGoal): string {
  const header = `## Goal ${goal.title}`;
  const inner: Record<string, unknown> = {};
  if (goal.level !== undefined) inner.level = goal.level;
  return assembleSection(header, inner, goal.description?.trim() ?? '');
}

function assembleSection(
  header: string,
  inner: Record<string, unknown>,
  body: string
): string {
  const hasInner = Object.keys(inner).length > 0;
  const pieces: string[] = [header];

  if (hasInner) {
    pieces.push(emitFrontmatterBlock(inner));
  }
  if (body !== '') {
    pieces.push(body);
  }
  return pieces.join('\n\n');
}
