/**
 * Provider-neutral transactional email boundary (master plan §12.5).
 * Domain/identity depend on EmailIntentPort; delivery workers on EmailDeliveryPort.
 * Do not reintroduce Resend or any feature-level provider SDK.
 */

export type EmailPurpose =
  | "identity_invitation"
  | "identity_verification"
  | "identity_recovery"
  | "security_alert"
  | "workflow_action"
  | "transaction_receipt"
  | "operational_notice"
  | "digest";

export interface EmailIntentCommand {
  intentId: string;
  source: { kind: "identity" | "tenant"; tenantId?: string; recordId: string };
  purpose: EmailPurpose;
  template: { id: string; version: number; locale: "th" | "en" };
  recipientRef: string;
  encryptedVariablesRef: string;
  rootRequestId: string;
  operationId: string;
  notAfter: string;
}

export type EmailSubmissionResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "rejected"; code: string; retryable: boolean }
  | { status: "unknown"; code: "PROVIDER_OUTCOME_UNKNOWN" };

export interface EmailIntentPort {
  enqueue(
    command: EmailIntentCommand,
  ): Promise<{ intentId: string; status: "queued" }>;
}

export interface RenderedTransactionalEmail {
  to: string | string[];
  templateId: string;
  variables: Record<string, string | number | boolean | null | undefined>;
  subject?: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface EmailDeliveryPort {
  send(message: RenderedTransactionalEmail): Promise<EmailSubmissionResult>;
}
