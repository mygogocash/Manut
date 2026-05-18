import yaml from 'js-yaml';

/**
 * M5.2 — AGENTS.md parser.
 *
 * Parses a Markdown document into the structured AgentsMdDocument
 * shape. The format is loosely modelled on the AGENTS.md community
 * convention: a YAML frontmatter block followed by Markdown sections
 * with predictable headers.
 *
 * Format:
 *
 *   ---
 *   <yaml frontmatter, optional>
 *   ---
 *
 *   ## Agent <name>
 *   <optional yaml frontmatter for this agent>
 *   ---
 *   <free-form description>
 *
 *   ## Agent <name 2>
 *   ...
 *
 *   ## Skill <slug>
 *   ---
 *   name: <display name>
 *   version: <version>
 *   ---
 *   <skill body markdown>
 *
 *   ## Goal <title>
 *   ---
 *   level: PROJECT
 *   ---
 *   <description>
 *
 * The parser is intentionally lenient: missing inner frontmatter blocks
 * are fine, unknown YAML keys are preserved on the agent / goal /
 * skill (round-trip stability), and trailing whitespace is normalised.
 *
 * The pairing builder in manut-agents-md-builder.ts produces output
 * that round-trips through this parser back to the same document.
 */

export interface AgentsMdAgent {
  name: string;
  role?: string;
  adapter?: string;
  capabilities?: string;
  skills?: string[];
  description?: string;
}

export interface AgentsMdSkill {
  slug: string;
  name: string;
  version?: string;
  body: string;
}

export interface AgentsMdGoal {
  title: string;
  level?: 'PROJECT' | 'TEAM' | 'AGENT' | 'TASK';
  description?: string;
}

export interface AgentsMdDocument {
  frontmatter?: Record<string, unknown>;
  agents: AgentsMdAgent[];
  skills: AgentsMdSkill[];
  goals: AgentsMdGoal[];
}

type SectionKind = 'agent' | 'skill' | 'goal';

interface RawSection {
  kind: SectionKind;
  header: string;
  body: string;
}

const FRONTMATTER_FENCE = '---';

/**
 * Parse an AGENTS.md document. Throws SyntaxError on malformed
 * frontmatter (unterminated ---, invalid YAML). Unknown headers are
 * silently ignored so unrelated `## Notes` blocks dont break import.
 */
export function parseAgentsMd(markdown: string): AgentsMdDocument {
  const normalised = markdown.replace(/\r\n/g, '\n');

  const { frontmatter, body } = splitFrontmatter(normalised);
  const sections = splitSections(body);

  const agents: AgentsMdAgent[] = [];
  const skills: AgentsMdSkill[] = [];
  const goals: AgentsMdGoal[] = [];

  for (const section of sections) {
    switch (section.kind) {
      case 'agent':
        agents.push(parseAgent(section.header, section.body));
        break;
      case 'skill':
        skills.push(parseSkill(section.header, section.body));
        break;
      case 'goal':
        goals.push(parseGoal(section.header, section.body));
        break;
    }
  }

  return {
    ...(frontmatter !== undefined ? { frontmatter } : {}),
    agents,
    skills,
    goals,
  };
}

function splitFrontmatter(markdown: string): {
  frontmatter?: Record<string, unknown>;
  body: string;
} {
  const trimmed = markdown.replace(/^﻿/, '');
  if (!trimmed.startsWith(`${FRONTMATTER_FENCE}\n`)) {
    return { body: trimmed };
  }

  const rest = trimmed.slice(FRONTMATTER_FENCE.length + 1);
  const endIdx = rest.indexOf(`\n${FRONTMATTER_FENCE}\n`);
  const endIdxAtEof = rest.endsWith(`\n${FRONTMATTER_FENCE}`)
    ? rest.length - FRONTMATTER_FENCE.length - 1
    : -1;
  const matchIdx = endIdx !== -1 ? endIdx : endIdxAtEof;

  if (matchIdx === -1) {
    throw new SyntaxError(
      'AGENTS.md: top-level frontmatter is not terminated with a --- line'
    );
  }

  const yamlText = rest.slice(0, matchIdx);
  const after = rest.slice(matchIdx + FRONTMATTER_FENCE.length + 1);
  const tail = after.startsWith('\n') ? after.slice(1) : after;

  const parsed = parseYaml(yamlText, 'top-level frontmatter');
  if (parsed === null || parsed === undefined) {
    return { body: tail };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SyntaxError(
      'AGENTS.md: top-level frontmatter must be a YAML mapping'
    );
  }
  return { frontmatter: parsed as Record<string, unknown>, body: tail };
}

function splitSections(body: string): RawSection[] {
  const lines = body.split('\n');
  const sections: RawSection[] = [];

  let current: RawSection | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (current) {
      while (buffer.length > 0 && buffer[buffer.length - 1] === '') {
        buffer.pop();
      }
      sections.push({ ...current, body: buffer.join('\n') });
    }
    current = null;
    buffer = [];
  };

  for (const line of lines) {
    const match = /^##\s+(Agent|Skill|Goal)\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      const kind = match[1].toLowerCase() as SectionKind;
      current = { kind, header: match[2], body: '' };
      continue;
    }
    if (current) {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

function parseAgent(name: string, body: string): AgentsMdAgent {
  const { frontmatter, rest } = splitInnerFrontmatter(body);
  const fm = (frontmatter ?? {}) as Record<string, unknown>;

  const description = rest.trim() === '' ? undefined : rest.trim();
  const role = stringField(fm, 'role');
  const adapter = stringField(fm, 'adapter');
  const capabilities = stringField(fm, 'capabilities');
  const skills = stringArrayField(fm, 'skills');

  return {
    name,
    ...(role !== undefined ? { role } : {}),
    ...(adapter !== undefined ? { adapter } : {}),
    ...(capabilities !== undefined ? { capabilities } : {}),
    ...(skills !== undefined ? { skills } : {}),
    ...(description !== undefined ? { description } : {}),
  };
}

function parseSkill(slug: string, body: string): AgentsMdSkill {
  const { frontmatter, rest } = splitInnerFrontmatter(body);
  const fm = (frontmatter ?? {}) as Record<string, unknown>;

  const name = stringField(fm, 'name') ?? slug;
  const version = stringField(fm, 'version');
  const skillBody = rest.replace(/^\n+/, '').replace(/\n+$/, '');

  return {
    slug,
    name,
    ...(version !== undefined ? { version } : {}),
    body: skillBody,
  };
}

function parseGoal(title: string, body: string): AgentsMdGoal {
  const { frontmatter, rest } = splitInnerFrontmatter(body);
  const fm = (frontmatter ?? {}) as Record<string, unknown>;

  const levelRaw = stringField(fm, 'level');
  let level: AgentsMdGoal['level'];
  if (
    levelRaw === 'PROJECT' ||
    levelRaw === 'TEAM' ||
    levelRaw === 'AGENT' ||
    levelRaw === 'TASK'
  ) {
    level = levelRaw;
  }
  const description = rest.trim() === '' ? undefined : rest.trim();

  return {
    title,
    ...(level !== undefined ? { level } : {}),
    ...(description !== undefined ? { description } : {}),
  };
}

function splitInnerFrontmatter(body: string): {
  frontmatter?: Record<string, unknown>;
  rest: string;
} {
  const trimmed = body.replace(/^\n+/, '');
  if (!trimmed.startsWith(`${FRONTMATTER_FENCE}\n`)) {
    return { rest: body };
  }
  const after = trimmed.slice(FRONTMATTER_FENCE.length + 1);
  const closeIdx = after.indexOf(`\n${FRONTMATTER_FENCE}\n`);
  const closeAtEof = after.endsWith(`\n${FRONTMATTER_FENCE}`)
    ? after.length - FRONTMATTER_FENCE.length - 1
    : -1;
  const matchIdx = closeIdx !== -1 ? closeIdx : closeAtEof;
  if (matchIdx === -1) {
    throw new SyntaxError(
      'AGENTS.md: section frontmatter is not terminated with a --- line'
    );
  }

  const yamlText = after.slice(0, matchIdx);
  const tailRaw = after.slice(matchIdx + FRONTMATTER_FENCE.length + 1);
  const tail = tailRaw.startsWith('\n') ? tailRaw.slice(1) : tailRaw;

  const parsed = parseYaml(yamlText, 'section frontmatter');
  if (parsed === null || parsed === undefined) {
    return { rest: tail };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SyntaxError(
      'AGENTS.md: section frontmatter must be a YAML mapping'
    );
  }
  return { frontmatter: parsed as Record<string, unknown>, rest: tail };
}

function parseYaml(text: string, label: string): unknown {
  if (text.trim() === '') return undefined;
  try {
    return yaml.load(text);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new SyntaxError(`AGENTS.md: failed to parse ${label}: ${cause}`);
  }
}

function stringField(
  fm: Record<string, unknown>,
  key: string
): string | undefined {
  const v = fm[key];
  if (typeof v === 'string') return v;
  return undefined;
}

function stringArrayField(
  fm: Record<string, unknown>,
  key: string
): string[] | undefined {
  const v = fm[key];
  if (!Array.isArray(v)) return undefined;
  const items = v.filter((x): x is string => typeof x === 'string');
  if (items.length === 0) return undefined;
  return items;
}
