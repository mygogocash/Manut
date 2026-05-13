import { BadRequestException, Injectable } from '@nestjs/common';

import { DocWriter } from '../../core/doc';

const MAX_HANDOVER_JSON_BYTES = 256 * 1024;
const MAX_AGENTS = 20;
const MAX_TASKS = 100;
const MAX_GATES = 50;
const MAX_TEXT = 500;
const MAX_LONG_TEXT = 2000;

export interface SuperflowHandoverImportResult {
  docId: string;
  title: string;
  updated: boolean;
}

interface SuperflowHandoverModel {
  schemaVersion: number;
  generatedAt: string;
  controlPlane: {
    source: string;
    company: string;
    goal: string;
  };
  workflow: {
    mode: string;
    status: string;
    repository: string;
    ref: string;
    actor: string;
    runId: string;
    runUrl: string;
  };
  release: {
    version: string;
    shortSha: string;
    headSha: string;
    imageTag: string;
    imageDigest: string;
    image: string;
    registry: string;
    deployUrl: string;
  };
  agents: Array<{
    role: string;
    adapter: string;
    responsibility: string;
  }>;
  taskTree: string[];
  verificationGates: string[];
  rollback: {
    workflow: string;
    vmSnapshot: string;
  };
}

export interface RenderedSuperflowHandover {
  title: string;
  markdown: string;
  handover: SuperflowHandoverModel;
}

@Injectable()
export class SuperflowHandoverService {
  constructor(private readonly docWriter: DocWriter) {}

  async importHandover(
    workspaceId: string,
    editorId: string,
    handoverJson: string,
    targetDocId?: string | null
  ): Promise<SuperflowHandoverImportResult> {
    const rendered = parseAndRenderSuperflowHandover(handoverJson);

    if (targetDocId) {
      await this.docWriter.updateDoc(
        workspaceId,
        targetDocId,
        rendered.markdown,
        editorId
      );
      await this.docWriter.updateDocMeta(
        workspaceId,
        targetDocId,
        { title: rendered.title },
        editorId
      );

      return {
        docId: targetDocId,
        title: rendered.title,
        updated: true,
      };
    }

    const result = await this.docWriter.createDoc(
      workspaceId,
      rendered.title,
      rendered.markdown,
      editorId
    );

    return {
      docId: result.docId,
      title: rendered.title,
      updated: false,
    };
  }
}

export function parseAndRenderSuperflowHandover(
  handoverJson: string
): RenderedSuperflowHandover {
  const handover = normalizeSuperflowHandover(parseJson(handoverJson));
  const version = handover.release.version || handover.release.imageTag;
  const suffix = version ? ` - ${version}` : '';
  const title = sanitizeInlineText(`Superflow Release Handover${suffix}`, 120);

  return {
    title,
    markdown: renderSuperflowHandoverMarkdown(handover),
    handover,
  };
}

export function renderSuperflowHandoverMarkdown(
  model: SuperflowHandoverModel
): string {
  const release = model.release;
  const workflow = model.workflow;

  return `Generated: ${value(model.generatedAt)}
Status: ${value(workflow.status)}
Mode: ${value(workflow.mode)}
Control plane: ${value(model.controlPlane.source)}

## Company Context

- Company: ${value(model.controlPlane.company)}
- Goal: ${value(model.controlPlane.goal)}
- Repository: ${value(workflow.repository)}
- Production URL: ${value(release.deployUrl)}

## Release Facts

| Field | Value |
| --- | --- |
| Version | ${value(release.version)} |
| Ref | ${value(workflow.ref)} |
| Commit | ${value(release.shortSha)} (${value(release.headSha)}) |
| Image tag | ${value(release.imageTag)} |
| Image digest | ${value(release.imageDigest)} |
| Image | ${value(release.image)} |
| Actor | ${value(workflow.actor)} |
| Run id | ${value(workflow.runId)} |
| Run URL | ${linkOrValue(workflow.runUrl)} |

## Agent Board

| Role | Adapter | Responsibility |
| --- | --- | --- |
${model.agents
  .map(
    agent =>
      `| ${value(agent.role)} | ${value(agent.adapter)} | ${value(agent.responsibility)} |`
  )
  .join('\n')}

## Task Tree

${model.taskTree.map((task, index) => `${index + 1}. ${value(task)}`).join('\n')}

## Verification Gates

${model.verificationGates.map(gate => `- ${value(gate)}`).join('\n')}

## Rollback

- Workflow: ${value(model.rollback.workflow)}
- VM snapshot: ${value(model.rollback.vmSnapshot)}
`;
}

function parseJson(handoverJson: string): unknown {
  if (typeof handoverJson !== 'string' || !handoverJson.trim()) {
    throw new BadRequestException('handoverJson is required');
  }

  if (Buffer.byteLength(handoverJson, 'utf8') > MAX_HANDOVER_JSON_BYTES) {
    throw new BadRequestException('handoverJson is too large');
  }

  try {
    return JSON.parse(handoverJson);
  } catch {
    throw new BadRequestException('handoverJson must be valid JSON');
  }
}

function normalizeSuperflowHandover(input: unknown): SuperflowHandoverModel {
  const model = objectAt(input, 'handover');

  if (model.schemaVersion !== 1) {
    throw new BadRequestException('Unsupported handover schemaVersion');
  }

  const workflow = objectAt(model.workflow, 'workflow');
  const release = objectAt(model.release, 'release');
  const controlPlane = objectAt(model.controlPlane, 'controlPlane');
  const rollback = objectAt(model.rollback, 'rollback');

  return {
    schemaVersion: 1,
    generatedAt: text(model.generatedAt, MAX_TEXT),
    controlPlane: {
      source: text(controlPlane.source, MAX_TEXT),
      company: text(controlPlane.company, MAX_TEXT),
      goal: text(controlPlane.goal, MAX_LONG_TEXT),
    },
    workflow: {
      mode: text(workflow.mode, MAX_TEXT),
      status: text(workflow.status, MAX_TEXT),
      repository: text(workflow.repository, MAX_TEXT),
      ref: text(workflow.ref, MAX_TEXT),
      actor: text(workflow.actor, MAX_TEXT),
      runId: text(workflow.runId, MAX_TEXT),
      runUrl: text(workflow.runUrl, MAX_LONG_TEXT),
    },
    release: {
      version: text(release.version, MAX_TEXT),
      shortSha: text(release.shortSha, MAX_TEXT),
      headSha: text(release.headSha, MAX_TEXT),
      imageTag: text(release.imageTag, MAX_TEXT),
      imageDigest: text(release.imageDigest, MAX_TEXT),
      image: text(release.image, MAX_LONG_TEXT),
      registry: text(release.registry, MAX_LONG_TEXT),
      deployUrl: text(release.deployUrl, MAX_LONG_TEXT),
    },
    agents: arrayAt(model.agents, 'agents', MAX_AGENTS).map((agent, index) => {
      const normalized = objectAt(agent, `agents[${index}]`);
      return {
        role: text(normalized.role, MAX_TEXT),
        adapter: text(normalized.adapter, MAX_TEXT),
        responsibility: text(normalized.responsibility, MAX_LONG_TEXT),
      };
    }),
    taskTree: arrayAt(model.taskTree, 'taskTree', MAX_TASKS).map(item =>
      text(item, MAX_LONG_TEXT)
    ),
    verificationGates: arrayAt(
      model.verificationGates,
      'verificationGates',
      MAX_GATES
    ).map(item => text(item, MAX_LONG_TEXT)),
    rollback: {
      workflow: text(rollback.workflow, MAX_TEXT),
      vmSnapshot: text(rollback.vmSnapshot, MAX_LONG_TEXT),
    },
  };
}

function objectAt(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException(`${label} must be an object`);
  }

  return input as Record<string, unknown>;
}

function arrayAt(input: unknown, label: string, maxItems: number): unknown[] {
  if (!Array.isArray(input)) {
    throw new BadRequestException(`${label} must be an array`);
  }

  if (input.length > maxItems) {
    throw new BadRequestException(`${label} has too many items`);
  }

  return input;
}

function text(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') {
    return '';
  }

  return sanitizeInlineText(input, maxLength);
}

function sanitizeInlineText(input: string, maxLength: number): string {
  return input
    .split('')
    .filter(c => c.charCodeAt(0) !== 0)
    .join('')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function value(input: string): string {
  return input ? escapeMarkdownTable(input) : 'unknown';
}

function linkOrValue(input: string): string {
  if (!input) {
    return 'unknown';
  }

  return `[${escapeMarkdownTable(input)}](${input})`;
}

function escapeMarkdownTable(input: string): string {
  return input.replace(/\|/g, '\\|');
}
