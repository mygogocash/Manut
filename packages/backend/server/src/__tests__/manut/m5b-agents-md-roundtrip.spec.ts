import test from 'ava';

import { buildAgentsMd } from '../../plugins/manut/manut-agents-md-builder';
import type { AgentsMdDocument } from '../../plugins/manut/manut-agents-md-parser';
import { parseAgentsMd } from '../../plugins/manut/manut-agents-md-parser';

/**
 * M5.2 — AGENTS.md round-trip golden tests.
 *
 * Each test constructs an AgentsMdDocument by hand, runs it through
 * buildAgentsMd, parses the result, and asserts the round-tripped
 * document is deep-equal to the original. This pins the contract:
 * any change to either the parser or builder that breaks symmetry
 * will surface as a failure here.
 */

function roundTrip(doc: AgentsMdDocument): AgentsMdDocument {
  return parseAgentsMd(buildAgentsMd(doc));
}

test('minimal: empty document', t => {
  const doc: AgentsMdDocument = {
    agents: [],
    skills: [],
    goals: [],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('single agent, name only', t => {
  const doc: AgentsMdDocument = {
    agents: [{ name: 'Solo' }],
    skills: [],
    goals: [],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('multi-agent with frontmatter and descriptions', t => {
  const doc: AgentsMdDocument = {
    frontmatter: { workspaceId: 'w1', version: 'v1' },
    agents: [
      {
        name: 'Reply Composer',
        role: 'composer',
        adapter: 'COPILOT_CHAT_SESSION',
        capabilities: 'Drafts ticket replies',
        skills: ['skill.reply-templates'],
        description: 'Drafts replies for human review.',
      },
      {
        name: 'Escalation Watcher',
        role: 'watcher',
        adapter: 'COPILOT_CHAT_SESSION',
        capabilities: 'Watches sentiment + SLAs',
      },
    ],
    skills: [],
    goals: [],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('agent with skill references', t => {
  const doc: AgentsMdDocument = {
    agents: [
      {
        name: 'X',
        skills: ['a', 'b', 'c'],
      },
    ],
    skills: [],
    goals: [],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('skill body with multi-paragraph markdown', t => {
  const doc: AgentsMdDocument = {
    agents: [],
    skills: [
      {
        slug: 'reply-templates',
        name: 'Reply Templates',
        version: '1.2.0',
        body: '# Reply templates\n\nUse this structure:\n\n1. Acknowledge\n2. Summarise\n3. Invite follow-up',
      },
    ],
    goals: [],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('multiple skills with different versions', t => {
  const doc: AgentsMdDocument = {
    agents: [],
    skills: [
      { slug: 's1', name: 'S1', version: '0.1.0', body: 'one' },
      { slug: 's2', name: 'S2', version: '2.0.0', body: 'two' },
      { slug: 's3', name: 'S3', body: 'three (no version)' },
    ],
    goals: [],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('all four goal levels', t => {
  const doc: AgentsMdDocument = {
    agents: [],
    skills: [],
    goals: [
      { title: 'g1', level: 'PROJECT', description: 'd1' },
      { title: 'g2', level: 'TEAM' },
      { title: 'g3', level: 'AGENT', description: 'd3' },
      { title: 'g4', level: 'TASK' },
    ],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('mixed: agents + skills + goals together', t => {
  const doc: AgentsMdDocument = {
    frontmatter: { workspaceId: 'w-abc', exportedAt: '2026-05-18' },
    agents: [
      {
        name: 'A1',
        role: 'r',
        adapter: 'COPILOT_CHAT_SESSION',
        description: 'desc1',
      },
    ],
    skills: [
      { slug: 'sk1', name: 'Skill 1', version: '0.1.0', body: '# body1' },
    ],
    goals: [{ title: 'g1', level: 'PROJECT', description: 'reach the moon' }],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('unicode and emoji in names round-trip', t => {
  const doc: AgentsMdDocument = {
    agents: [{ name: 'العميل 1', description: 'مرحبا' }],
    skills: [{ slug: 'thai', name: 'ทักษะ', body: 'ทดสอบภาษาไทย' }],
    goals: [{ title: '目标一号', level: 'TEAM' }],
  };
  t.deepEqual(roundTrip(doc), doc);
});

test('builder output is stable across runs (deterministic)', t => {
  const doc: AgentsMdDocument = {
    agents: [{ name: 'A', role: 'r' }],
    skills: [{ slug: 's', name: 'S', body: 'x' }],
    goals: [{ title: 'G', level: 'PROJECT' }],
  };
  const first = buildAgentsMd(doc);
  const second = buildAgentsMd(doc);
  t.is(first, second);
});
