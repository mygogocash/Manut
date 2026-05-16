import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { DocWriter } from '../../core/doc';
import { MnReleaseRunsService } from './manut-release-runs.service';

const MAX_HANDOVER_JSON_BYTES = 256 * 1024;
const MAX_AGENTS = 20;
const MAX_TASKS = 100;
const MAX_GATES = 50;
const MAX_TEXT = 500;
const MAX_LONG_TEXT = 2000;

export interface MnHandoverImportResult {
  docId: string;
  title: string;
  updated: boolean;
}

interface MnHandoverModel {
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

export interface RenderedMnHandover {
  title: string;
  markdown: string;
  handover: MnHandoverModel;
}

@Injectable()
export class MnHandoverService {
  private readonly logger = new Logger(MnHandoverService.name);

  constructor(
    private readonly docWriter: DocWriter,
    private readonly releaseRuns: MnReleaseRunsService
  ) {}

  async importHandover(
    workspaceId: string,
    editorId: string,
    handoverJson: string,
    targetDocId?: string | null
  ): Promise<MnHandoverImportResult> {
    const rendered = parseAndRenderManutHandover(handoverJson);

    let result: MnHandoverImportResult;

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

      result = {
        docId: targetDocId,
        title: rendered.title,
        updated: true,
      };
    } else {
      const created = await this.docWriter.createDoc(
        workspaceId,
        rendered.title,
        rendered.markdown,
        editorId
      );

      result = {
        docId: created.docId,
        title: rendered.title,
        updated: false,
      };
    }

    // Doc write is the source of truth. The release run board is a
    // secondary projection — if persisting it fails (DB outage, schema
    // drift, etc.) we still want the import call to succeed so the user
    // gets their handover doc. Log the failure for ops to investigate.
    try {
      await this.releaseRuns.recordRunFromHandover(workspaceId, handoverJson);
    } catch (err) {
      this.logger.warn(
        `Failed to record release run for workspace ${workspaceId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    return result;
  }
}

export function parseAndRenderManutHandover(
  handoverJson: string
): RenderedMnHandover {
  const handover = normalizeMnHandover(parseJson(handoverJson));
  const version = handover.release.version || handover.release.imageTag;
  const suffix = version ? ` - ${version}` : '';
  const title = sanitizeInlineText(`Manut Release Handover${suffix}`, 120);

  return {
    title,
    markdown: renderManutHandoverMarkdown(handover),
    handover,
  };
}

export function renderManutHandoverMarkdown(model: MnHandoverModel): string {
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

function normalizeMnHandover(input: unknown): MnHandoverModel {
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

  // SECURITY (H9): only wrap http(s) URLs as Markdown links. Other
  // schemes (javascript:, file:, data:, custom protocols, schemeless)
  // are rendered as plain text to prevent link injection / XSS / SSRF
  // when the rendered Markdown is consumed downstream. We strip the
  // closing bracket ']' from the displayed text so a crafted value
  // can't break out of the link's display segment either.
  const safeDisplay = escapeMarkdownTable(input).replace(/]/g, '');

  if (/^https?:\/\//i.test(input)) {
    return `[${safeDisplay}](${input})`;
  }

  return safeDisplay;
}

function escapeMarkdownTable(input: string): string {
  return input.replace(/\|/g, '\\|');
}
