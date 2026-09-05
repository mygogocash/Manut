import { logger } from "@/common/utils/logger";

const EMAIL_SERVICE_API_KEY = process.env.EMAIL_SERVICE_API_KEY?.trim();
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL?.trim();
const WELCOME_EMAIL_TEMPLATE_ID = "welcome-intranet";
const WELCOME_EMAIL_BODY =
  "Your intranet account has been created. Sign in with the details below.";

export type EmailTemplateVariables = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface SendEmailInput {
  to: string | string[];
  templateId: string;
  variables: EmailTemplateVariables;
  subject?: string;
  html?: string;
  replyTo?: string;
}

interface SendWelcomeTemplateEmailInput {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
  portalUrl: string;
}

/** Outcome of a delivery attempt. `retryable` distinguishes a transient
 * transport/5xx failure from a permanent rejection (4xx / not configured). */
export interface EmailDeliveryResult {
  ok: boolean;
  error?: string;
  retryable?: boolean;
}

/**
 * Attempts one delivery and REPORTS the outcome, so callers that need retry or
 * an audit trail can observe failures. `sendEmail` wraps this and keeps its
 * original fire-and-forget behaviour for every existing caller.
 */
export async function deliverEmail(
  input: SendEmailInput,
): Promise<EmailDeliveryResult> {
  if (!EMAIL_SERVICE_URL || !EMAIL_SERVICE_API_KEY) {
    logger.warn("Email not sent (email service not configured)", {
      to: input.to,
      templateId: input.templateId,
      hasUrl: Boolean(EMAIL_SERVICE_URL),
      hasApiKey: Boolean(EMAIL_SERVICE_API_KEY),
    });
    // Misconfiguration is permanent until an operator fixes it — retrying the
    // same request would only burn attempts.
    return {
      ok: false,
      error: "email service not configured",
      retryable: false,
    };
  }

  try {
    const response = await fetch(
      `${EMAIL_SERVICE_URL.replace(/\/+$/, "")}/api/emails`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": EMAIL_SERVICE_API_KEY,
        },
        body: JSON.stringify({
          templateId: input.templateId,
          to: input.to,
          variables: input.variables,
          ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        }),
      },
    );

    if (!response.ok) {
      const responseBody = await response.text();
      logger.error("Email service API error", {
        status: response.status,
        body: responseBody,
        to: input.to,
        templateId: input.templateId,
      });
      return {
        ok: false,
        error: `HTTP ${response.status}: ${responseBody.slice(0, 300)}`,
        // 5xx / 429 are worth another attempt; a 4xx is a bad request.
        retryable: response.status >= 500 || response.status === 429,
      };
    }

    logger.info("Email sent successfully", {
      to: input.to,
      templateId: input.templateId,
    });
    return { ok: true };
  } catch (err) {
    logger.error("Failed to send email", {
      error: err,
      to: input.to,
      templateId: input.templateId,
    });
    // Network-level failure — always worth retrying.
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      retryable: true,
    };
  }
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  // Behaviour preserved exactly: never throws, never reports.
  await deliverEmail(input);
}

export async function sendWelcomeTemplateEmail(
  input: SendWelcomeTemplateEmailInput,
): Promise<void> {
  await sendEmail({
    to: input.to,
    templateId: WELCOME_EMAIL_TEMPLATE_ID,
    variables: {
      BODY: WELCOME_EMAIL_BODY,
      name: input.name,
      portalUrl: input.portalUrl,
      email: input.email,
      temporaryPassword: input.temporaryPassword,
    },
  });
}
