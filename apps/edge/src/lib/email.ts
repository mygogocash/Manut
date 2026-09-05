import type { AuthEmailSender } from "@nexora/auth";

type EmailBindings = {
  EMAIL_SERVICE_URL?: string;
  EMAIL_SERVICE_API_KEY?: string;
  APP_URL: string;
};

/**
 * Port of apps/api email.service deliverEmail — HTTP POST to the shared email
 * service. Magic-link / reset use a simple html template until dedicated
 * template ids are provisioned.
 */
export function createEmailSender(env: EmailBindings): AuthEmailSender {
  return {
    async sendMagicLink({ email, url }) {
      await deliver(env, {
        to: email,
        templateId: "auth-magic-link",
        subject: "Your Intranet sign-in link",
        variables: { url, portalUrl: env.APP_URL },
        html: `<p>Sign in to Intranet:</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
      });
    },
    async sendResetPassword({ email, url }) {
      await deliver(env, {
        to: email,
        templateId: "auth-reset-password",
        subject: "Reset your Intranet password",
        variables: { url, portalUrl: env.APP_URL },
        html: `<p>Reset your password:</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
      });
    },
  };
}

async function deliver(
  env: EmailBindings,
  input: {
    to: string;
    templateId: string;
    subject: string;
    variables: Record<string, string>;
    html: string;
  },
): Promise<void> {
  const base = env.EMAIL_SERVICE_URL?.replace(/\/+$/, "");
  const key = env.EMAIL_SERVICE_API_KEY;
  if (!base || !key) {
    console.warn(JSON.stringify({ level: "warn", msg: "email_not_configured", to: input.to, templateId: input.templateId }));
    return;
  }
  const res = await fetch(`${base}/api/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      templateId: input.templateId,
      to: input.to,
      subject: input.subject,
      variables: input.variables,
      html: input.html,
    }),
  });
  if (!res.ok) {
    console.error(JSON.stringify({ level: "error", msg: "email_send_failed", status: res.status, templateId: input.templateId }));
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
