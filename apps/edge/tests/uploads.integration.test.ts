import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { createEdgeApp } from "../src/index";

const AUTHORIZATION = "Bearer test-token-that-is-long-enough-for-edge-auth";

interface IntentResponse {
  intentId: string;
  token: string;
  uploadUrl: string;
}

interface DownloadIntentResponse {
  downloadUrl: string;
  token: string;
}

describe("R2 transfer route", () => {
  it("rejects an invalid intent path before touching R2", async () => {
    const app = createEdgeApp({
      verifyToken: async () => ({
        role: "employee",
        subject: "employee-r2-test",
      }),
    });
    const response = await app.request(
      "http://localhost/api/v1/uploads/not-an-intent/download-intent",
      {
        headers: { authorization: AUTHORIZATION },
        method: "POST",
      },
      env,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "UPLOAD_NOT_FOUND",
    });
  });

  it("uploads, finalizes, and downloads through short-lived signed intents", async () => {
    const app = createEdgeApp({
      verifyToken: async () => ({
        role: "employee",
        subject: "employee-r2-test",
      }),
    });
    const createResponse = await app.request(
      "http://localhost/api/v1/uploads/intents",
      {
        body: JSON.stringify({
          contentType: "text/plain",
          fileName: "proof.txt",
          size: 5,
        }),
        headers: {
          authorization: AUTHORIZATION,
          "content-type": "application/json",
        },
        method: "POST",
      },
      env,
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as IntentResponse;
    expect(created.intentId).toBeTruthy();

    const uploadResponse = await app.request(
      created.uploadUrl,
      {
        body: "proof",
        headers: {
          authorization: AUTHORIZATION,
          "content-length": "5",
          "content-type": "text/plain",
          "x-manut-transfer-intent": created.token,
        },
        method: "PUT",
      },
      env,
    );
    expect(uploadResponse.status).toBe(201);

    const finalizeResponse = await app.request(
      `http://localhost/api/v1/uploads/${created.intentId}/finalize`,
      {
        headers: {
          authorization: AUTHORIZATION,
          "x-manut-transfer-intent": created.token,
        },
        method: "POST",
      },
      env,
    );
    expect(finalizeResponse.status).toBe(200);

    const intentResponse = await app.request(
      `http://localhost/api/v1/uploads/${created.intentId}/download-intent`,
      {
        headers: { authorization: AUTHORIZATION },
        method: "POST",
      },
      env,
    );
    expect(intentResponse.status).toBe(200);
    const downloadIntent =
      (await intentResponse.json()) as DownloadIntentResponse;

    const downloadResponse = await app.request(
      downloadIntent.downloadUrl,
      {
        headers: {
          authorization: AUTHORIZATION,
          "x-manut-transfer-intent": downloadIntent.token,
        },
      },
      env,
    );
    expect(downloadResponse.status).toBe(200);
    await expect(downloadResponse.text()).resolves.toBe("proof");
    expect(downloadResponse.headers.get("cache-control")).toBe(
      "private, no-store",
    );
    expect(downloadResponse.headers.get("content-disposition")).toBe(
      'attachment; filename="proof.txt"',
    );
  });
});
