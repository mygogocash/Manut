import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnAgentApiKey } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import {
  MintMnAgentApiKeySchema,
  type MintMnAgentApiKeyValues,
} from './manut-agent.dto';
import { MnAgentService } from './manut-agent.service';

/**
 * Prefix on the plaintext token. Lets ops + scrubbers identify a
 * Manut agent key on sight (e.g. in a paste, in a leaked log). The
 * prefix is part of the hashed material — changing it invalidates
 * every previously-issued key.
 */
const API_KEY_PREFIX = 'mn_ak_';

/**
 * Random bytes appended after the prefix. 32 bytes ≈ 256 bits of
 * entropy, encoded base64url for URL-safe pasting.
 */
const API_KEY_ENTROPY_BYTES = 32;

/**
 * Hash design note — why SHA-256 instead of bcrypt/argon2:
 *
 *   The schema declares `key_hash VARCHAR @unique`. A salted hash
 *   (bcrypt / argon2) is by design *not* unique across re-hashes of
 *   the same input, so it cannot serve as the indexed unique key the
 *   auth lookup path needs. We'd have to enumerate every stored row
 *   and compare-bcrypt against each — O(N) per request — for any
 *   meaningful key population.
 *
 *   The mitigations bcrypt/argon2 provide (slow + salted) exist
 *   because passwords have low entropy (~30 bits typical). Our API
 *   keys are 256 bits of crypto-random entropy. Brute-forcing those
 *   is infeasible regardless of the digest algorithm. So a fast
 *   deterministic SHA-256 is sound, and matches the design of every
 *   major API-key system (GitHub, Stripe, AWS IAM access keys, etc.):
 *     - high-entropy plaintext token,
 *     - deterministic hash for O(1) indexed lookup,
 *     - plaintext shown ONCE at mint time and never persisted.
 *
 *   The plaintext is the secret. The hash is the cache key.
 */
function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

/**
 * Mints + revokes API keys for Manut agents.
 *
 * The plaintext token is returned ONCE on `mint`. After that call the
 * server keeps only the hash and the operator must save the plaintext
 * out-of-band (1Password, env var, etc.). This is the GitHub /
 * Stripe / AWS IAM model — same UX assumptions.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` on the class so NestJS DI sees the constructor
 *    metadata (v1.12.0 production scar — undecorated providers crash
 *    with TypeError on first method call).
 *  - `PrismaClient` and `MnAgentService` are RUNTIME imports because
 *    they are constructor DI targets (v1.12.0 scar — `import type` on
 *    a DI target erases the runtime class to `Object`).
 */
@Injectable()
export class MnAgentApiKeyService {
  constructor(
    private readonly db: PrismaClient,
    private readonly agents: MnAgentService
  ) {}

  /**
   * List active + revoked keys for an agent. Sorted by creation date
   * descending so the most-recent issuance is on top.
   *
   * Keys are SCOPED BY WORKSPACE — pass the workspaceId so a caller
   * who knows an agentId from another workspace can't enumerate its
   * key list.
   */
  async list(workspaceId: string, agentId: string): Promise<MnAgentApiKey[]> {
    // Ownership check first so we 404 (not silently-return-empty) on
    // a cross-tenant agentId guess.
    await this.agents.getOrThrow(workspaceId, agentId);
    return this.db.mnAgentApiKey.findMany({
      where: { agentId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /**
   * Mint a fresh API key for `agentId`.
   *
   * Returns `{ key, plaintext }`. The `plaintext` field is the
   * once-shown secret the operator must save now — it is NOT
   * recoverable after this call returns.
   *
   * The `key` row contains everything else (id, name, timestamps)
   * and is what subsequent list / revoke calls reference.
   */
  async mint(
    workspaceId: string,
    agentId: string,
    input: MintMnAgentApiKeyValues
  ): Promise<{ key: MnAgentApiKey; plaintext: string }> {
    const values = MintMnAgentApiKeySchema.parse(input);
    const agent = await this.agents.getOrThrow(workspaceId, agentId);

    const plaintext = generatePlaintextApiKey();
    const keyHash = hashApiKey(plaintext);

    const key = await this.db.mnAgentApiKey.create({
      data: {
        id: randomUUID(),
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        projectId: agent.projectId,
        name: values.name,
        keyHash,
      },
    });

    return { key, plaintext };
  }

  /**
   * Soft-revoke: set `revokedAt = now()`. Idempotent — revoking an
   * already-revoked key is a no-op and returns the unchanged row.
   *
   * Soft instead of hard because we want to keep the audit trail
   * (who issued the key, when it was used last). Authentication code
   * MUST check `revokedAt IS NULL` on every lookup.
   */
  async revoke(
    workspaceId: string,
    agentId: string,
    keyId: string
  ): Promise<MnAgentApiKey> {
    await this.agents.getOrThrow(workspaceId, agentId);

    const key = await this.db.mnAgentApiKey.findUnique({
      where: { id: keyId },
    });
    if (!key) {
      throw new NotFoundException(`API key '${keyId}' not found`);
    }
    if (key.agentId !== agentId) {
      // Cross-agent fence: a key id from one agent must not be
      // revokable through another agent's mutation surface.
      throw new BadRequestException(
        `API key '${keyId}' does not belong to agent '${agentId}'`
      );
    }
    if (key.revokedAt !== null) {
      // Idempotent — already revoked, return the row unchanged.
      return key;
    }
    return this.db.mnAgentApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Resolve a plaintext bearer token to its row, IF the token is
   * known AND not revoked. Returns `null` on miss.
   *
   * Side effect: stamps `lastUsedAt` on a successful match so the
   * "stale keys" admin view has signal to work with. Best-effort —
   * we don't fail the auth path if the stamp update errors out.
   *
   * This is the entry point future auth middleware will call.
   */
  async resolve(plaintext: string): Promise<MnAgentApiKey | null> {
    if (!plaintext || !plaintext.startsWith(API_KEY_PREFIX)) return null;
    const keyHash = hashApiKey(plaintext);
    const key = await this.db.mnAgentApiKey.findUnique({
      where: { keyHash },
    });
    if (!key) return null;
    if (key.revokedAt !== null) return null;
    // Best-effort stamp; swallow errors so a transient DB hiccup
    // doesn't block authentication.
    try {
      await this.db.mnAgentApiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      /* noop */
    }
    return key;
  }
}

/**
 * Plaintext token shape: `mn_ak_<base64url(32 random bytes)>`.
 * Exported for tests that need to assert on the prefix.
 */
export function generatePlaintextApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_ENTROPY_BYTES).toString('base64url')}`;
}

export { API_KEY_PREFIX, hashApiKey };
