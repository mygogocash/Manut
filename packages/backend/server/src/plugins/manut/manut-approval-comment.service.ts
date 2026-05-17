import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import type { MnApprovalComment } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import {
  CreateMnApprovalCommentSchema,
  type CreateMnApprovalCommentValues,
} from './manut-approval.dto';
import { MnApprovalService } from './manut-approval.service';

/**
 * CRUD for comments attached to an MnApproval. Kept in its own service
 * so the approvals resolver stays focused on the decision flow and
 * comments can grow new behaviour (mentions, attachments) without
 * bloating MnApprovalService.
 *
 * Cross-workspace safety: comments are scoped to the approval, which is
 * scoped to a workspace. The service uses `MnApprovalService.getOrThrow`
 * to validate the parent approval belongs to the caller's workspace
 * BEFORE writing the comment row. That keeps the comment write atomic
 * and avoids a separate workspace-id lookup.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TS emits `design:paramtypes`.
 *  - `PrismaClient`, `MnApprovalService` are runtime imports.
 */
@Injectable()
export class MnApprovalCommentService {
  constructor(
    private readonly db: PrismaClient,
    private readonly approvals: MnApprovalService
  ) {}

  /**
   * Create a comment under the given approval. The author is either an
   * authenticated user (passed in via `authorUserId`) OR an agent
   * (passed in via `input.authorAgentId`). Both may be present —
   * that's a comment authored by an agent acting on behalf of a user.
   */
  async create(
    workspaceId: string,
    approvalId: string,
    authorUserId: string | null,
    input: CreateMnApprovalCommentValues
  ): Promise<MnApprovalComment> {
    const values = CreateMnApprovalCommentSchema.parse(input);
    const approval = await this.approvals.getOrThrow(workspaceId, approvalId);

    return this.db.mnApprovalComment.create({
      data: {
        id: randomUUID(),
        approvalId: approval.id,
        projectId: approval.projectId,
        body: values.body,
        authorAgentId: values.authorAgentId ?? null,
        authorUserId,
      },
    });
  }

  /**
   * List comments for an approval, oldest-first so the inbox renders a
   * chronological thread. Cross-workspace lookups return 404 (no info
   * leak) via the parent-approval guard.
   */
  async list(
    workspaceId: string,
    approvalId: string
  ): Promise<MnApprovalComment[]> {
    const approval = await this.approvals.get(workspaceId, approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval '${approvalId}' not found`);
    }
    return this.db.mnApprovalComment.findMany({
      where: { approvalId: approval.id },
      orderBy: [{ createdAt: 'asc' }],
    });
  }
}
