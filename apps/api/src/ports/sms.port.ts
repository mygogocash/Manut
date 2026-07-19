/**
 * Provider-neutral SMS OTP boundary (master plan §12.6).
 * Identity depends on SmsIntentPort; the SMS worker on SmsDeliveryPort.
 * No production provider is wired yet — stubs must fail closed.
 */

export type SmsPurpose =
  | "customer_sign_in"
  | "phone_enrollment"
  | "phone_replacement"
  | "customer_access_recovery";

export interface SmsIntentCommand {
  intentId: string;
  ceremonyId: string;
  purpose: SmsPurpose;
  recipientRef: string;
  sponsorReservationId: string;
  maximumSegments: 1;
  encryptedVariablesRef: string;
  locale: "th" | "en";
  operationId: string;
  rootRequestId: string;
  notAfter: string;
}

export type SmsSubmissionResult =
  | {
      status: "accepted";
      providerMessageId: string;
      segments: number;
      costUnits?: number;
    }
  | { status: "rejected"; code: string; retryable: boolean }
  | { status: "unknown"; code: "PROVIDER_OUTCOME_UNKNOWN" };

export interface SmsIntentPort {
  enqueue(command: SmsIntentCommand): Promise<{
    intentId: string;
    status: "queued";
  }>;
}

export interface RenderedOtpSms {
  toE164: string;
  body: string;
  purpose: SmsPurpose;
  locale: "th" | "en";
}

export interface SmsDeliveryPort {
  send(message: RenderedOtpSms): Promise<SmsSubmissionResult>;
}
