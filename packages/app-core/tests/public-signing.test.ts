import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getPublicSigningRequest,
  publicSigningQueryKey,
} from "../src/legal/public-signing";

describe("public signing contracts", () => {
  it("loads a token signing request without inventing document content", async () => {
    const signal = { aborted: false };
    const getPublic = vi.fn().mockResolvedValue({
      data: {
        signature: {
          id: "sig-1",
          documentId: "doc-1",
          signerEmail: "signer@example.com",
          signerName: "Signer",
          status: "sent",
          inviteMessage: "Please review",
          signedAt: null,
          declinedAt: null,
          declineReason: null,
          expiresAt: "2026-08-01T00:00:00.000Z",
          token: "secret-token",
          ipAddress: "1.2.3.4",
        },
        document: {
          id: "doc-1",
          title: "Offer letter",
          kind: "contract",
          fileUrl: "https://files.example/doc.pdf",
          fileName: "offer.pdf",
          status: "active",
        },
      },
    });
    const client = { getPublic } as unknown as ApiClient;

    const result = await getPublicSigningRequest(client, "token-1", signal);
    expect(result.document.title).toBe("Offer letter");
    expect(result.signature.signerName).toBe("Signer");
    expect(result.signature).not.toHaveProperty("token");
    expect(result.signature).not.toHaveProperty("ipAddress");
    expect(getPublic).toHaveBeenCalledWith("/legal-public/sign/token-1", {
      signal,
    });
    expect(publicSigningQueryKey("token-1")).toEqual([
      "legal-public",
      "sign",
      "token-1",
    ]);
  });
});
