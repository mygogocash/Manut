import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

export function generateApiKey(): { key: string; hash: string } {
  const raw = `affine_mcp_${randomBytes(32).toString('hex')}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  return { key: raw, hash };
}

@Injectable()
export class McpApiKeyService {
  constructor(private readonly db: PrismaClient) {}

  async createApiKey(
    userId: string,
    name: string,
    workspaceId?: string,
    expiresAt?: Date
  ): Promise<string> {
    const { key, hash } = generateApiKey();
    await this.db.mcpApiKey.create({
      data: {
        userId,
        workspaceId: workspaceId ?? null,
        keyHash: hash,
        name,
        expiresAt: expiresAt ?? null,
      },
    });
    // Return plaintext key only once — it cannot be retrieved again
    return key;
  }

  async validateApiKey(
    key: string
  ): Promise<{ userId: string; workspaceId: string | null } | null> {
    const hash = createHash('sha256').update(key).digest('hex');
    const record = await this.db.mcpApiKey.findUnique({
      where: { keyHash: hash },
    });
    if (!record) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Update lastUsedAt asynchronously — don't block the request
    this.db.mcpApiKey
      .update({
        where: { keyHash: hash },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // best-effort; ignore errors
      });

    return { userId: record.userId, workspaceId: record.workspaceId };
  }

  async listApiKeys(userId: string) {
    return this.db.mcpApiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async deleteApiKey(userId: string, keyId: string): Promise<void> {
    await this.db.mcpApiKey.deleteMany({ where: { id: keyId, userId } });
  }
}
