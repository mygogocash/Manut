import { describe, expect, it } from "vitest";

import type { SmsIntentCommand } from "@/ports/sms.port";

import {
  createFailClosedSmsDeliveryAdapter,
  createFailClosedSmsIntentAdapter,
  SMS_NOT_CONFIGURED_CODE,
} from "./sms-ports.stub";

function sampleSmsCommand(): SmsIntentCommand {
  return {
    intentId: "sms-intent-1",
    ceremonyId: "ceremony-1",
    purpose: "customer_sign_in",
    recipientRef: "phone-ref-1",
    sponsorReservationId: "sponsor-1",
    maximumSegments: 1,
    encryptedVariablesRef: "vars-ref-1",
    locale: "th",
    operationId: "op-1",
    rootRequestId: "root-1",
    notAfter: new Date(Date.now() + 60_000).toISOString(),
  };
}

describe("SMS ports > fail-closed stubs", () => {
  it("SmsIntentPort.enqueue rejects instead of queueing", async () => {
    const port = createFailClosedSmsIntentAdapter();

    await expect(port.enqueue(sampleSmsCommand())).rejects.toThrow(
      /SMS intent delivery is not configured/i,
    );
  });

  it("SmsDeliveryPort.send returns non-retryable rejected", async () => {
    const port = createFailClosedSmsDeliveryAdapter();

    await expect(
      port.send({
        toE164: "+66812345678",
        body: "Your code is 123456",
        purpose: "customer_sign_in",
        locale: "th",
      }),
    ).resolves.toEqual({
      status: "rejected",
      code: SMS_NOT_CONFIGURED_CODE,
      retryable: false,
    });
  });
});
