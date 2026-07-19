import type {
  RenderedOtpSms,
  SmsDeliveryPort,
  SmsIntentCommand,
  SmsIntentPort,
  SmsSubmissionResult,
} from "@/ports/sms.port";

export const SMS_NOT_CONFIGURED_CODE = "SMS_NOT_CONFIGURED";

/**
 * Fail-closed SMS intent stub. No provider is approved yet; enqueue must not
 * silently succeed or fall back to email/log.
 */
export class FailClosedSmsIntentAdapter implements SmsIntentPort {
  async enqueue(
    _command: SmsIntentCommand,
  ): Promise<{ intentId: string; status: "queued" }> {
    throw new Error("SMS intent delivery is not configured");
  }
}

/**
 * Fail-closed SMS delivery stub. Always rejects with a non-retryable code.
 */
export class FailClosedSmsDeliveryAdapter implements SmsDeliveryPort {
  async send(_message: RenderedOtpSms): Promise<SmsSubmissionResult> {
    return {
      status: "rejected",
      code: SMS_NOT_CONFIGURED_CODE,
      retryable: false,
    };
  }
}

export function createFailClosedSmsIntentAdapter(): SmsIntentPort {
  return new FailClosedSmsIntentAdapter();
}

export function createFailClosedSmsDeliveryAdapter(): SmsDeliveryPort {
  return new FailClosedSmsDeliveryAdapter();
}
