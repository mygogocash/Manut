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

class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

async function deliverEmail(input: SendEmailInput): Promise<void> {
  if (!EMAIL_SERVICE_URL || !EMAIL_SERVICE_API_KEY) {
    throw new EmailDeliveryError("Email service is not configured");
  }

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
    throw new EmailDeliveryError(
      `Email service rejected the request with status ${response.status}`,
    );
  }

  logger.info("Email sent successfully", {
    to: input.to,
    templateId: input.templateId,
  });
}

function logDeliveryFailure(input: SendEmailInput, err: unknown) {
  logger.error("Failed to send email", {
    error: err instanceof Error ? err.message : String(err),
    to: input.to,
    templateId: input.templateId,
  });
}

/** Best-effort delivery for notifications that must not roll back an action. */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  try {
    await deliverEmail(input);
  } catch (err) {
    logDeliveryFailure(input, err);
  }
}

/**
 * Required delivery for flows where advancing state without notifying the
 * recipient would strand the workflow. Callers must keep state retryable when
 * this rejects.
 */
export async function sendRequiredEmail(input: SendEmailInput): Promise<void> {
  try {
    await deliverEmail(input);
  } catch (err) {
    logDeliveryFailure(input, err);
    if (err instanceof Error) throw err;
    throw new EmailDeliveryError("Email delivery failed");
  }
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
