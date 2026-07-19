import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailIntentCommand } from "@/ports/email.port";

import {
  createLegacyHttpEmailDeliveryAdapter,
  createLegacyHttpEmailIntentAdapter,
  encodeLegacyEmailIntentRefs,
} from "./email-ports.adapter";

function sampleCommand(
  overrides: Partial<EmailIntentCommand> = {},
): EmailIntentCommand {
  const refs = encodeLegacyEmailIntentRefs({
    to: "user@example.com",
    templateId: "workflow_action",
    variables: { name: "Ada" },
  });

  return {
    intentId: "intent-1",
    source: { kind: "tenant", tenantId: "t1", recordId: "rec-1" },
    purpose: "workflow_action",
    template: { id: "workflow_action", version: 1, locale: "en" },
    recipientRef: refs.recipientRef,
    encryptedVariablesRef: refs.encryptedVariablesRef,
    rootRequestId: "root-1",
    operationId: "op-1",
    notAfter: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe("LegacyHttpEmail ports > adapter wiring", () => {
  const sendEmail = vi.fn();
  const sendRequiredEmail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("EmailIntentPort.enqueue wraps sendEmail and reports queued", async () => {
    sendEmail.mockResolvedValue(undefined);
    const port = createLegacyHttpEmailIntentAdapter(sendEmail);

    await expect(port.enqueue(sampleCommand())).resolves.toEqual({
      intentId: "intent-1",
      status: "queued",
    });

    expect(sendEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      templateId: "workflow_action",
      variables: { name: "Ada" },
    });
  });

  it("EmailDeliveryPort.send wraps sendRequiredEmail and returns accepted", async () => {
    sendRequiredEmail.mockResolvedValue(undefined);
    const port = createLegacyHttpEmailDeliveryAdapter(sendRequiredEmail);

    await expect(
      port.send({
        to: "user@example.com",
        templateId: "workflow_action",
        variables: { name: "Ada" },
      }),
    ).resolves.toEqual({
      status: "accepted",
      providerMessageId: "legacy-http:workflow_action",
    });

    expect(sendRequiredEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      templateId: "workflow_action",
      variables: { name: "Ada" },
    });
  });

  it("EmailDeliveryPort.send maps delivery failures to rejected", async () => {
    sendRequiredEmail.mockRejectedValue(new Error("Email service is not configured"));
    const port = createLegacyHttpEmailDeliveryAdapter(sendRequiredEmail);

    await expect(
      port.send({
        to: "user@example.com",
        templateId: "workflow_action",
        variables: {},
      }),
    ).resolves.toEqual({
      status: "rejected",
      code: "EMAIL_DELIVERY_FAILED",
      retryable: true,
    });
  });

  it("does not import a third-party email provider package", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./email-ports.adapter.ts", import.meta.url), "utf8"),
    );
    expect(source).not.toMatch(/from\s+["']resend["']/);
    expect(source).not.toMatch(/RESEND_API_KEY/);
    expect(source).not.toMatch(/new\s+Resend\b/);
  });
});

