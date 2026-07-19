import {
  type EmailTemplateVariables,
  sendEmail,
  type SendEmailInput,
  sendRequiredEmail,
} from "@/infrastructure/email/email.service";
import type {
  EmailDeliveryPort,
  EmailIntentCommand,
  EmailIntentPort,
  EmailSubmissionResult,
  RenderedTransactionalEmail,
} from "@/ports/email.port";

const LEGACY_PAYLOAD_PREFIX = "legacy-json:";

export interface LegacyEmailPayload {
  to: string | string[];
  templateId: string;
  variables: EmailTemplateVariables;
  subject?: string;
  html?: string;
  replyTo?: string;
}

/**
 * Encode a current sendEmail payload into EmailIntentCommand refs so the
 * legacy intent adapter can call sendEmail without a D1 outbox yet.
 */
export function encodeLegacyEmailIntentRefs(payload: LegacyEmailPayload): {
  recipientRef: string;
  encryptedVariablesRef: string;
} {
  const to = Array.isArray(payload.to) ? payload.to[0] : payload.to;
  return {
    recipientRef: to ?? "",
    encryptedVariablesRef:
      LEGACY_PAYLOAD_PREFIX +
      JSON.stringify({
        to: payload.to,
        templateId: payload.templateId,
        variables: payload.variables,
        ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
        ...(payload.html !== undefined ? { html: payload.html } : {}),
        ...(payload.replyTo !== undefined ? { replyTo: payload.replyTo } : {}),
      } satisfies LegacyEmailPayload),
  };
}

function decodeLegacyEmailPayload(
  command: EmailIntentCommand,
): SendEmailInput {
  const ref = command.encryptedVariablesRef;
  if (!ref.startsWith(LEGACY_PAYLOAD_PREFIX)) {
    throw new Error(
      "Legacy email intent requires a legacy-json encryptedVariablesRef",
    );
  }

  const parsed = JSON.parse(
    ref.slice(LEGACY_PAYLOAD_PREFIX.length),
  ) as LegacyEmailPayload;

  return {
    to: parsed.to,
    templateId: parsed.templateId || command.template.id,
    variables: parsed.variables,
    ...(parsed.subject !== undefined ? { subject: parsed.subject } : {}),
    ...(parsed.html !== undefined ? { html: parsed.html } : {}),
    ...(parsed.replyTo !== undefined ? { replyTo: parsed.replyTo } : {}),
  };
}

export type SendEmailFn = (input: SendEmailInput) => Promise<void>;
export type SendRequiredEmailFn = (input: SendEmailInput) => Promise<void>;

/**
 * Best-effort intent enqueue → current sendEmail (HTTP email service).
 * Provider SDKs stay out of this adapter; only the existing HTTP path is used.
 */
export class LegacyHttpEmailIntentAdapter implements EmailIntentPort {
  constructor(private readonly send: SendEmailFn = sendEmail) {}

  async enqueue(
    command: EmailIntentCommand,
  ): Promise<{ intentId: string; status: "queued" }> {
    await this.send(decodeLegacyEmailPayload(command));
    return { intentId: command.intentId, status: "queued" };
  }
}

/**
 * Required delivery path → current sendRequiredEmail.
 */
export class LegacyHttpEmailDeliveryAdapter implements EmailDeliveryPort {
  constructor(private readonly sendRequired: SendRequiredEmailFn = sendRequiredEmail) {}

  async send(
    message: RenderedTransactionalEmail,
  ): Promise<EmailSubmissionResult> {
    try {
      await this.sendRequired({
        to: message.to,
        templateId: message.templateId,
        variables: message.variables,
        ...(message.subject !== undefined ? { subject: message.subject } : {}),
        ...(message.html !== undefined ? { html: message.html } : {}),
        ...(message.replyTo !== undefined ? { replyTo: message.replyTo } : {}),
      });
      return {
        status: "accepted",
        providerMessageId: `legacy-http:${message.templateId}`,
      };
    } catch {
      return {
        status: "rejected",
        code: "EMAIL_DELIVERY_FAILED",
        retryable: true,
      };
    }
  }
}

export function createLegacyHttpEmailIntentAdapter(
  send?: SendEmailFn,
): EmailIntentPort {
  return new LegacyHttpEmailIntentAdapter(send);
}

export function createLegacyHttpEmailDeliveryAdapter(
  sendRequired?: SendRequiredEmailFn,
): EmailDeliveryPort {
  return new LegacyHttpEmailDeliveryAdapter(sendRequired);
}
