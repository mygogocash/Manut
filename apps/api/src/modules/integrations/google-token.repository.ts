import { prisma } from "@/infrastructure/database/prisma";
import { decrypt, encrypt } from "@/modules/integrations/crypto";
import {
  type GoogleTokens,
  refreshAccessToken,
} from "@/modules/integrations/google-oauth.service";

const REFRESH_THRESHOLD_MS = 60 * 1000; // refresh if <60s remain

interface UpsertInput {
  userId: string;
  accountEmail: string;
  tokens: GoogleTokens;
}

interface ValidTokenResult {
  accessToken: string;
  accountEmail: string;
  scope: string;
}

interface ConnectionMeta {
  connected: boolean;
  accountEmail?: string;
  scope?: string;
  expiresAt?: Date;
}

function expiresAtFromIn(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

export const googleTokenRepository = {
  async upsert({ userId, accountEmail, tokens }: UpsertInput): Promise<void> {
    if (!tokens.refreshToken) {
      throw new Error(
        "Google did not return a refresh_token. Re-consent with prompt=consent.",
      );
    }
    const accessTokenEnc = encrypt(tokens.accessToken);
    const refreshTokenEnc = encrypt(tokens.refreshToken);
    const expiresAt = expiresAtFromIn(tokens.expiresIn);

    await prisma.userGoogleConnection.upsert({
      where: { userId },
      create: {
        userId,
        accountEmail,
        accessToken: accessTokenEnc,
        refreshToken: refreshTokenEnc,
        scope: tokens.scope,
        tokenType: tokens.tokenType,
        expiresAt,
        encryptionVersion: 1,
      },
      update: {
        accountEmail,
        accessToken: accessTokenEnc,
        refreshToken: refreshTokenEnc,
        scope: tokens.scope,
        tokenType: tokens.tokenType,
        expiresAt,
        encryptionVersion: 1,
      },
    });
  },

  async getValid(userId: string): Promise<ValidTokenResult> {
    const row = await prisma.userGoogleConnection.findUnique({
      where: { userId },
    });
    if (!row) {
      throw new Error("GOOGLE_NOT_CONNECTED");
    }

    const msUntilExpiry = row.expiresAt.getTime() - Date.now();
    if (msUntilExpiry > REFRESH_THRESHOLD_MS) {
      return {
        accessToken: decrypt(row.accessToken),
        accountEmail: row.accountEmail,
        scope: row.scope,
      };
    }

    const refreshToken = decrypt(row.refreshToken);
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not configured",
      );
    }

    const refreshed = await refreshAccessToken({
      refreshToken,
      clientId,
      clientSecret,
    });

    const newAccessEnc = encrypt(refreshed.accessToken);
    const newExpiresAt = expiresAtFromIn(refreshed.expiresIn);
    const updateData: Record<string, unknown> = {
      accessToken: newAccessEnc,
      expiresAt: newExpiresAt,
    };
    if (refreshed.refreshToken) {
      updateData.refreshToken = encrypt(refreshed.refreshToken);
    }

    if (refreshed.scope) {
      updateData.scope = refreshed.scope;
    }

    await prisma.userGoogleConnection.update({
      where: { userId },
      data: updateData,
    });

    return {
      accessToken: refreshed.accessToken,
      accountEmail: row.accountEmail,
      scope: refreshed.scope || row.scope,
    };
  },

  async delete(userId: string): Promise<void> {
    try {
      await prisma.userGoogleConnection.delete({ where: { userId } });
    } catch (err) {
      // P2025 = "Record to delete does not exist." Idempotent.
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2025"
      ) {
        return;
      }
      throw err;
    }
  },

  async findByUserId(userId: string): Promise<ConnectionMeta> {
    const row = await prisma.userGoogleConnection.findUnique({
      where: { userId },
    });
    if (!row) return { connected: false };
    return {
      connected: true,
      accountEmail: row.accountEmail,
      scope: row.scope,
      expiresAt: row.expiresAt,
    };
  },
};
