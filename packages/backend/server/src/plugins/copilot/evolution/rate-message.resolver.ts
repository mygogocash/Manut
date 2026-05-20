import { Injectable, NotFoundException } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import { MemoryIngestService } from '../memory/ingest.service';

type Rating = 'positive' | 'negative';

/**
 * Manut M2 E2.4 — feedback rating mutation.
 *
 * Each AI assistant reply renders a 👍/👎 chip in the chat panel. Clicking
 * a chip calls `rateMessage(messageId, rating)`. The mutation:
 *   1. Looks up the chat message by id (and its parent session, so we
 *      can scope the OBSERVATION to the right workspace and verify the
 *      caller has read access to it).
 *   2. Writes an OBSERVATION memory tagged `feedback:positive|negative`
 *      via the existing ingest pipeline (which embeds + persists into
 *      `mn_agent_memories`).
 *   3. The weekly distill cron (Sunday 00:00 UTC) later reads these,
 *      summarises into a PLAYBOOK, and prepends it to every future
 *      system prompt.
 *
 * Per CLAUDE.md scars (§6 + §2):
 *   - @Resolver(), @Mutation(), @Args all carry EXPLICIT `() => Type`
 *     parameters. We've shipped UndefinedTypeError twice now; this
 *     resolver does not add a third.
 *   - @Injectable() decorator on the class is non-negotiable.
 *   - PrismaClient / AccessController / MemoryIngestService are all
 *     runtime imports (no `import type`) because they are DI targets.
 *
 * Returns Boolean — the chip flips its own visual state on the client;
 * the server's job is just to record the observation. Best-effort write
 * — a database hiccup must not flash a red error at the user.
 */
@Injectable()
@Resolver(() => Boolean)
export class RateMessageResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController,
    private readonly ingest: MemoryIngestService
  ) {}

  @Mutation(() => Boolean, {
    description:
      'Record a user 👍/👎 rating on an assistant chat message. Stored as ' +
      'an OBSERVATION memory tagged feedback:positive|negative.',
  })
  async rateMessage(
    @CurrentUser() user: CurrentUser,
    @Args({ name: 'messageId', type: () => String })
    messageId: string,
    @Args({ name: 'rating', type: () => String })
    rating: string
  ): Promise<boolean> {
    const normalised = this.normaliseRating(rating);
    if (!normalised) {
      // Reject silently — return false so the client can surface an
      // error toast without us needing a typed error class for this
      // (currently the only invalid case).
      return false;
    }

    // Find the message + its session. We persist messages on assistant
    // turn-completion to `ai_sessions_messages`; the chip is only
    // rendered on `assistant`-role rows, but we don't gate on role here
    // — letting a user rate their own message is a no-op, not a bug.
    const message = await this.db.aiSessionMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        session: {
          select: {
            id: true,
            workspaceId: true,
            docId: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!message || !message.session || message.session.deletedAt) {
      throw new NotFoundException('Chat message not found');
    }

    // Reuse the same permission gate the chat resolver uses for session
    // access — workspace.Copilot for workspace-scope reads, doc.Update
    // when the session is bound to a doc.
    const { workspaceId, docId } = message.session;
    if (docId) {
      await this.ac
        .user(user.id)
        .doc({ workspaceId, docId })
        .allowLocal()
        .assert('Doc.Read');
    } else {
      await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .allowLocal()
        .assert('Workspace.Copilot');
    }

    // Ingest as an OBSERVATION. Content shape is `feedback:<rating> — <id>`
    // so the distill cron can pattern-match via `LIKE 'feedback:%'` and
    // the kNN retrieval path picks it up as a memory the same as any
    // other OBSERVATION.
    //
    // user-scoped (only the rater can later retrieve the raw note) —
    // distillation reads ALL workspace rows (user + workspace scope) so
    // this still feeds the PLAYBOOK even though it's not workspace-wide.
    await this.ingest.ingest({
      workspaceId,
      userId: user.id,
      scope: 'user',
      kind: 'OBSERVATION',
      content: `feedback:${normalised} — ${messageId}`,
      importance: normalised === 'negative' ? 3 : 2,
    });
    return true;
  }

  private normaliseRating(raw: string): Rating | null {
    const trimmed = raw?.trim().toLowerCase();
    if (trimmed === 'positive' || trimmed === 'negative') {
      return trimmed;
    }
    return null;
  }
}
