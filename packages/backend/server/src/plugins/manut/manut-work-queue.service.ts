import { randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnWorkQueue, MnWorkQueueIntake } from '@prisma/client';
import { MnIntakeStatus, MnTaskPriority, PrismaClient } from '@prisma/client';

/**
 * M14 — Work Queue CRUD + intake routing.
 *
 * The hot path is `routeIntake(queueId, payload)`: it fetches the queue,
 * evaluates `routingRules` IN ORDER (first match wins), creates an
 * `MnTask`, and persists an `MnWorkQueueIntake` row pointing at the new
 * task. If no rule matches but `defaultAssigneeAgentId` is set, the task
 * is created assigned to that agent. If no rule matches AND no default
 * is configured, the task is created unassigned (status BACKLOG) and the
 * intake row records ROUTED — operators can pick it up from the queue
 * inbox UI.
 *
 * Token rotation: `rotateToken(queueId)` writes a new
 * `intakeWebhookToken` so the OLD token becomes a 404 the moment the
 * rotation lands. The mutation is the only legitimate way to change
 * the token — the schema marks it `@unique` so collisions are rejected
 * by Postgres rather than a TOCTOU check.
 *
 * @Injectable + RUNTIME `PrismaClient` per the v1.12.0 DI scar.
 */

/**
 * Recognised routing-rule operators. `eq` is exact string match; `contains`
 * is case-insensitive substring match. New ops can be added here without
 * a schema migration because `routingRules` is JSONB.
 */
export type MnWorkQueueRuleOp = 'eq' | 'contains';

export interface MnWorkQueueRuleMatch {
  field: string;
  op: MnWorkQueueRuleOp;
  value: string;
}

export interface MnWorkQueueRule {
  match: MnWorkQueueRuleMatch;
  assignToAgentId?: string;
  assignToRoleSlug?: string;
}

export interface RouteIntakeOptions {
  externalRef?: string | null;
  /** Override the default title derived from payload.title. */
  titleOverride?: string;
}

export interface RouteIntakeResult {
  intake: MnWorkQueueIntake;
  taskId: string | null;
  matchedRuleIndex: number | null;
  assignedAgentId: string | null;
}

export interface CreateWorkQueueInput {
  projectId: string;
  name: string;
  description?: string | null;
  routingRulesJson?: string | null;
  defaultAssigneeAgentId?: string | null;
  defaultPriority?: MnTaskPriority | null;
}

export interface UpdateWorkQueueInput {
  name?: string | null;
  description?: string | null;
  routingRulesJson?: string | null;
  defaultAssigneeAgentId?: string | null;
  defaultPriority?: MnTaskPriority | null;
  isActive?: boolean | null;
}

@Injectable()
export class MnWorkQueueService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Generate a webhook token. 24 bytes of crypto-random base64url (~32
   * chars). Long enough to make brute force infeasible, short enough to
   * paste into webhook configs without line-wrapping.
   */
  private generateToken(): string {
    return randomBytes(24).toString('base64url');
  }

  /**
   * Validate `routingRulesJson`. Returns the parsed array or throws
   * `BadRequestException`. We intentionally do NOT validate per-rule
   * assignee references against the agents table here — the agent
   * could be deleted later, and routing falls back to the queue default
   * in that case. We DO reject malformed structure so the routing loop
   * never sees nonsense.
   */
  private parseRoutingRules(
    json: string | null | undefined
  ): MnWorkQueueRule[] {
    if (!json) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new BadRequestException('routingRulesJson is not valid JSON');
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException('routingRulesJson must be a JSON array');
    }
    return parsed.map((raw, idx) => {
      if (!raw || typeof raw !== 'object') {
        throw new BadRequestException(`routingRules[${idx}] must be an object`);
      }
      const rec = raw as Record<string, unknown>;
      const match = rec.match;
      if (!match || typeof match !== 'object') {
        throw new BadRequestException(`routingRules[${idx}].match is required`);
      }
      const mrec = match as Record<string, unknown>;
      if (typeof mrec.field !== 'string' || mrec.field.length === 0) {
        throw new BadRequestException(
          `routingRules[${idx}].match.field must be a non-empty string`
        );
      }
      if (mrec.op !== 'eq' && mrec.op !== 'contains') {
        throw new BadRequestException(
          `routingRules[${idx}].match.op must be 'eq' or 'contains'`
        );
      }
      if (typeof mrec.value !== 'string') {
        throw new BadRequestException(
          `routingRules[${idx}].match.value must be a string`
        );
      }
      const rule: MnWorkQueueRule = {
        match: {
          field: mrec.field,
          op: mrec.op,
          value: mrec.value,
        },
      };
      if (typeof rec.assignToAgentId === 'string') {
        rule.assignToAgentId = rec.assignToAgentId;
      }
      if (typeof rec.assignToRoleSlug === 'string') {
        rule.assignToRoleSlug = rec.assignToRoleSlug;
      }
      return rule;
    });
  }

  /**
   * Resolve a dot-separated path against a payload. Returns the value at
   * that path or undefined. Used to extract `match.field` from the
   * incoming JSON. Returns non-strings as-is so callers can decide;
   * `evaluateRule` only matches when the resolved value is a string.
   */
  private resolvePath(payload: unknown, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = payload;
    for (const seg of segments) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[seg];
    }
    return current;
  }

  /**
   * Test a single rule against a payload. Returns true on match. Skips
   * rules whose resolved field is non-string (defensive — payloads from
   * external systems may have arbitrary shapes; we don't want a Number
   * to silently coerce into a String match).
   */
  private evaluateRule(rule: MnWorkQueueRule, payload: unknown): boolean {
    const value = this.resolvePath(payload, rule.match.field);
    if (typeof value !== 'string') return false;
    if (rule.match.op === 'eq') {
      return value === rule.match.value;
    }
    return value.toLowerCase().includes(rule.match.value.toLowerCase());
  }

  async create(
    workspaceId: string,
    input: CreateWorkQueueInput
  ): Promise<MnWorkQueue> {
    if (!input.name.trim()) {
      throw new BadRequestException('Work queue name cannot be empty');
    }
    // Validate project belongs to the workspace.
    const project = await this.db.mnProject.findUnique({
      where: { id: input.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.workspaceId !== workspaceId) {
      throw new BadRequestException('Project does not belong to workspace');
    }
    // Parse rules eagerly so a bad JSON blob fails the create rather
    // than the first webhook delivery.
    const rules = this.parseRoutingRules(input.routingRulesJson);

    return this.db.mnWorkQueue.create({
      data: {
        id: randomUUID(),
        workspaceId,
        projectId: input.projectId,
        name: input.name.trim(),
        description: input.description ?? null,
        intakeWebhookToken: this.generateToken(),
        routingRules: rules as unknown as object,
        defaultAssigneeAgentId: input.defaultAssigneeAgentId ?? null,
        defaultPriority: input.defaultPriority ?? MnTaskPriority.LOW,
      },
    });
  }

  async update(
    workspaceId: string,
    queueId: string,
    input: UpdateWorkQueueInput
  ): Promise<MnWorkQueue> {
    const queue = await this.getOrThrow(workspaceId, queueId);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined && input.name !== null) {
      const trimmed = input.name.trim();
      if (!trimmed) {
        throw new BadRequestException('Work queue name cannot be empty');
      }
      data.name = trimmed;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.routingRulesJson !== undefined) {
      data.routingRules = this.parseRoutingRules(
        input.routingRulesJson
      ) as unknown as object;
    }
    if (input.defaultAssigneeAgentId !== undefined) {
      data.defaultAssigneeAgentId = input.defaultAssigneeAgentId;
    }
    if (input.defaultPriority !== undefined && input.defaultPriority !== null) {
      data.defaultPriority = input.defaultPriority;
    }
    if (input.isActive !== undefined && input.isActive !== null) {
      data.isActive = input.isActive;
    }
    return this.db.mnWorkQueue.update({
      where: { id: queue.id },
      data,
    });
  }

  /**
   * Rotate the webhook token. Old token becomes a 404 immediately
   * because the controller looks up by `intakeWebhookToken` which is a
   * unique key — once rewritten, the prior value is gone.
   */
  async rotateToken(
    workspaceId: string,
    queueId: string
  ): Promise<MnWorkQueue> {
    const queue = await this.getOrThrow(workspaceId, queueId);
    return this.db.mnWorkQueue.update({
      where: { id: queue.id },
      data: { intakeWebhookToken: this.generateToken() },
    });
  }

  /**
   * Archive (soft-delete): flip isActive=false so webhooks stop routing
   * but historical intake rows stay intact for audit. The public
   * controller rejects intake into inactive queues with HTTP 410 Gone.
   */
  async archive(workspaceId: string, queueId: string): Promise<MnWorkQueue> {
    const queue = await this.getOrThrow(workspaceId, queueId);
    return this.db.mnWorkQueue.update({
      where: { id: queue.id },
      data: { isActive: false },
    });
  }

  async getOrThrow(workspaceId: string, queueId: string): Promise<MnWorkQueue> {
    const queue = await this.db.mnWorkQueue.findUnique({
      where: { id: queueId },
    });
    if (!queue) {
      throw new NotFoundException('Work queue not found');
    }
    if (queue.workspaceId !== workspaceId) {
      throw new NotFoundException('Work queue not found');
    }
    return queue;
  }

  async listForWorkspace(workspaceId: string): Promise<MnWorkQueue[]> {
    return this.db.mnWorkQueue.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async listIntakes(
    workspaceId: string,
    queueId: string,
    limit = 100
  ): Promise<MnWorkQueueIntake[]> {
    await this.getOrThrow(workspaceId, queueId);
    return this.db.mnWorkQueueIntake.findMany({
      where: { queueId },
      orderBy: [{ receivedAt: 'desc' }],
      take: limit,
    });
  }

  /**
   * Look up a queue by its webhook token. Used by the controller before
   * routing. Returns null when no row matches (the controller maps that
   * to HTTP 404 — we deliberately don't leak which tokens existed once).
   */
  async findByToken(token: string): Promise<MnWorkQueue | null> {
    return this.db.mnWorkQueue.findUnique({
      where: { intakeWebhookToken: token },
    });
  }

  /**
   * The hot path. Evaluates rules first-match-wins, creates the
   * follow-up task, and records the intake. Returns the routing
   * decision so the controller can echo it back to the caller (useful
   * for webhook senders that want to verify the routing they
   * expected).
   */
  async routeIntake(
    queueId: string,
    payload: unknown,
    options: RouteIntakeOptions = {}
  ): Promise<RouteIntakeResult> {
    const queue = await this.db.mnWorkQueue.findUnique({
      where: { id: queueId },
    });
    if (!queue) {
      throw new NotFoundException('Work queue not found');
    }
    if (!queue.isActive) {
      // Persist the receipt anyway so the caller can audit, but mark
      // it REJECTED and don't create a task.
      const intake = await this.db.mnWorkQueueIntake.create({
        data: {
          id: randomUUID(),
          queueId: queue.id,
          externalRef: options.externalRef ?? null,
          payload: (payload ?? null) as unknown as object,
          status: MnIntakeStatus.REJECTED,
        },
      });
      return {
        intake,
        taskId: null,
        matchedRuleIndex: null,
        assignedAgentId: null,
      };
    }

    const rules = this.parseRoutingRules(
      typeof queue.routingRules === 'string'
        ? queue.routingRules
        : JSON.stringify(queue.routingRules ?? [])
    );

    let matchedRuleIndex: number | null = null;
    let assignedAgentId: string | null = null;
    for (let idx = 0; idx < rules.length; idx++) {
      if (this.evaluateRule(rules[idx], payload)) {
        matchedRuleIndex = idx;
        const rule = rules[idx];
        if (rule.assignToAgentId) {
          assignedAgentId = rule.assignToAgentId;
        } else if (rule.assignToRoleSlug) {
          // Resolve the role slug → an agent in this workspace + project
          // with that role. First match wins; if none found we leave
          // unassigned (the default-assignee fallback runs below).
          const role = await this.db.mnAgentRole.findFirst({
            where: {
              workspaceId: queue.workspaceId,
              slug: rule.assignToRoleSlug,
            },
          });
          if (role) {
            const agent = await this.db.mnAgent.findFirst({
              where: {
                workspaceId: queue.workspaceId,
                projectId: queue.projectId,
                roleId: role.id,
              },
              orderBy: { createdAt: 'asc' },
            });
            if (agent) {
              assignedAgentId = agent.id;
            }
          }
        }
        break;
      }
    }

    // Default assignee fallback when no rule resolved an agent.
    if (assignedAgentId === null && queue.defaultAssigneeAgentId) {
      assignedAgentId = queue.defaultAssigneeAgentId;
    }

    const title = options.titleOverride
      ? options.titleOverride
      : this.deriveTitle(payload, queue.name);

    const task = await this.db.mnTask.create({
      data: {
        id: randomUUID(),
        projectId: queue.projectId,
        title,
        description: this.deriveDescription(
          payload,
          options.externalRef ?? null
        ),
        priority: queue.defaultPriority,
        assigneeAgentId: assignedAgentId,
      },
    });

    const intake = await this.db.mnWorkQueueIntake.create({
      data: {
        id: randomUUID(),
        queueId: queue.id,
        externalRef: options.externalRef ?? null,
        payload: (payload ?? null) as unknown as object,
        status: MnIntakeStatus.ROUTED,
        routedToTaskId: task.id,
      },
    });

    return {
      intake,
      taskId: task.id,
      matchedRuleIndex,
      assignedAgentId,
    };
  }

  private deriveTitle(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
      const rec = payload as Record<string, unknown>;
      if (typeof rec.title === 'string' && rec.title.trim()) {
        return rec.title.trim().slice(0, 200);
      }
      if (typeof rec.subject === 'string' && rec.subject.trim()) {
        return rec.subject.trim().slice(0, 200);
      }
    }
    return `Intake: ${fallback}`;
  }

  private deriveDescription(
    payload: unknown,
    externalRef: string | null
  ): string {
    const lines: string[] = [];
    if (externalRef) {
      lines.push(`External ref: ${externalRef}`);
    }
    if (payload && typeof payload === 'object') {
      const rec = payload as Record<string, unknown>;
      if (typeof rec.body === 'string') {
        lines.push(rec.body.slice(0, 2000));
      } else if (typeof rec.description === 'string') {
        lines.push(rec.description.slice(0, 2000));
      } else {
        lines.push('Payload:');
        lines.push(JSON.stringify(payload, null, 2).slice(0, 2000));
      }
    }
    return lines.join('\n\n');
  }
}
